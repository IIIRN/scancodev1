'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db } from '../../../lib/firebase';
import {
  doc, getDoc, updateDoc, addDoc, collection,
  serverTimestamp, query, where, getDocs, runTransaction
} from 'firebase/firestore';
import { createCheckInSuccessFlex, createEvaluationRequestFlex } from '../../../lib/flexMessageTemplates';

const CameraIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

export default function UniversalScannerPage() {
  const [scanMode, setScanMode] = useState('check-in');
  const [searchMode, setSearchMode] = useState('scan');
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [nationalIdInput, setNationalIdInput] = useState('');
  const [scannerState, setScannerState] = useState('idle');
  const [foundData, setFoundData] = useState(null);
  const [seatNumberInput, setSeatNumberInput] = useState('');
  const [message, setMessage] = useState('');
  const qrScannerRef = useRef(null);

  useEffect(() => {
    const fetchActivities = async () => {
      const activitiesSnapshot = await getDocs(collection(db, 'activities'));
      setActivities(activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchActivities();
  }, []);

  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
        try {
            await qrScannerRef.current.stop();
        } catch (err) {
            console.warn("Scanner stop failed.", err);
        }
    }
  };

  const resetState = () => {
    stopScanner();
    setFoundData(null);
    setSeatNumberInput('');
    setMessage('');
    setNationalIdInput('');
    setScannerState('idle');
  };
  
  const handleActivityChange = (e) => {
      const activity = activities.find(a => a.id === e.target.value);
      setSelectedActivity(activity);
      resetState();
  };
  
  const handleModeChange = (newMode, modeType) => {
    stopScanner().then(() => {
        if (modeType === 'scan') setScanMode(newMode);
        if (modeType === 'search') setSearchMode(newMode);
        resetState();
    });
  };

  const processId = async (registrationId) => {
    setScannerState('submitting');
    try {
        const regRef = doc(db, 'registrations', registrationId);
        const regDoc = await getDoc(regRef);

        if (!regDoc.exists() || regDoc.data().activityId !== selectedActivity.id) {
            throw new Error('QR Code หรือข้อมูลไม่ถูกต้องสำหรับกิจกรรมนี้');
        }
        
        const registrationData = { id: regDoc.id, ...regDoc.data() };
        setFoundData({ registration: registrationData, activity: selectedActivity });
        if (registrationData.seatNumber) setSeatNumberInput(registrationData.seatNumber);
        setScannerState('found');
        setMessage('');

    } catch(err) {
        setMessage(`❌ ${err.message}`);
        setScannerState('idle');
    }
  };

  const handleStartScanner = () => {
    if (!selectedActivity) {
      setMessage('กรุณาเลือกกิจกรรมก่อน');
      return;
    }
    
    stopScanner().then(() => {
        resetState();
        setTimeout(() => {
            setScannerState('scanning');
            qrScannerRef.current = new Html5Qrcode("reader");
            qrScannerRef.current.start(
                { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    stopScanner();
                    processId(decodedText);
                }, () => {}
            ).catch(err => {
                setMessage(`ไม่สามารถเปิดกล้องได้: ${err.name}`);
                setScannerState('idle');
            });
        }, 100);
    });
  };
  
  const handleManualSearch = async (e) => {
    e.preventDefault();
    await handleModeChange(searchMode, 'search');
    setScannerState('submitting');
    try {
      const q = query(collection(db, 'registrations'), where("activityId", "==", selectedActivity.id), where("nationalId", "==", nationalIdInput.trim()));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('ไม่พบข้อมูลนักเรียนในกิจกรรมนี้');
      processId(snapshot.docs[0].id);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
      setScannerState('idle');
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setScannerState('submitting');
    if (scanMode === 'check-in') {
        if (selectedActivity.type === 'queue') await handleQueueCheckIn();
        else await handleEventCheckIn();
    } else {
        await handleCheckOut();
    }
  };
  
  const handleEventCheckIn = async () => {
    if (!seatNumberInput.trim()) {
      setMessage("กรุณากำหนดเลขที่นั่ง"); 
      setScannerState('found');
      return;
    }
    try {
        const { registration, activity } = foundData;
        const regRef = doc(db, 'registrations', registration.id);
        await updateDoc(regRef, { 
            status: 'checked-in', 
            seatNumber: seatNumberInput.trim() 
        });
        setMessage(`✅ เช็คอิน ${registration.fullName} สำเร็จ!`);
        setTimeout(() => resetState(), 2000);
    } catch (error) {
        setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        setScannerState('found');
    }
  };
  
  const handleQueueCheckIn = async () => {
    try {
        const { registration } = foundData;
        const result = await runTransaction(db, async (transaction) => {
            const regRef = doc(db, 'registrations', registration.id);
            const regDoc = await transaction.get(regRef);
            if (!regDoc.exists()) throw new Error("ไม่พบข้อมูล");

            const regData = regDoc.data();
            if (regData.status === 'checked-in') throw new Error(`ได้รับคิวแล้ว (คิวที่ ${regData.queueNumber})`);
            if (!regData.course) throw new Error('นักเรียนยังไม่ได้ถูกกำหนดหลักสูตร');

            const q = query(collection(db, 'registrations'), 
                where("activityId", "==", selectedActivity.id),
                where("course", "==", regData.course),
                where("status", "==", "checked-in")
            );
            
            const checkedInSnapshot = await getDocs(q);
            const nextQueueNumber = checkedInSnapshot.size + 1;

            transaction.update(regRef, { status: 'checked-in', queueNumber: nextQueueNumber });
            
            return { name: regData.fullName, queue: nextQueueNumber, course: regData.course };
        });

        setMessage(`✅ สำเร็จ! ${result.name} ได้รับคิวที่ ${result.queue} (${result.course})`);
        setTimeout(() => resetState(), 2000);
    } catch (err) {
        setMessage(`❌ ${err.message}`);
        setScannerState('found');
    }
  };

  const handleCheckOut = async () => {
    try {
        const { registration, activity } = foundData;
        const regRef = doc(db, 'registrations', registration.id);
        
        await updateDoc(regRef, {
            status: 'completed',
            completedAt: serverTimestamp()
        });

        if (registration.lineUserId) {
            const flexMessage = createEvaluationRequestFlex({
                activityId: registration.activityId,
                activityName: activity.name,
            });
            await fetch('/api/send-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: registration.lineUserId, flexMessage })
            });
        }
        
        setMessage(`✅ ${registration.fullName} จบกิจกรรมแล้ว`);
        setTimeout(() => resetState(), 2000);

    } catch(err) {
        setMessage(`เกิดข้อผิดพลาด: ${err.message}`);
        setScannerState('found');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8 font-sans">
      <div className="bg-white p-6 rounded-lg shadow-2xl min-h-[500px] flex flex-col items-center">
        <div className="w-full mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">เลือกกิจกรรม</label>
            <select onChange={handleActivityChange} defaultValue="" required className="w-full p-2 border rounded">
                <option value="" disabled>-- กรุณาเลือกกิจกรรม --</option>
                {activities.map(act => <option key={act.id} value={act.id}>{act.name}</option>)}
            </select>
        </div>

        {selectedActivity && (
            <>
                <div className="flex justify-center border rounded-lg p-1 bg-gray-100 mb-4 w-full">
                    <button onClick={() => handleModeChange('check-in', 'scan')} className={`w-1/2 py-2 rounded-md ${scanMode === 'check-in' ? 'bg-green-600 text-white' : ''}`}>เช็คอิน</button>
                    <button onClick={() => handleModeChange('check-out', 'scan')} className={`w-1/2 py-2 rounded-md ${scanMode === 'check-out' ? 'bg-red-600 text-white' : ''}`}>จบกิจกรรม</button>
                </div>
                
                <div className="flex justify-center border rounded-lg p-1 bg-gray-100 mb-6 w-full">
                    <button onClick={() => handleModeChange('scan', 'search')} className={`w-1/2 py-2 rounded-md ${searchMode === 'scan' ? 'bg-primary text-white' : ''}`}>สแกน</button>
                    <button onClick={() => handleModeChange('manual', 'search')} className={`w-1/2 py-2 rounded-md ${searchMode === 'manual' ? 'bg-primary text-white' : ''}`}>ค้นหา</button>
                </div>

                {message && <p className="mb-4 text-center font-bold">{message}</p>}

                {searchMode === 'scan' && (
                    <>
                        <div id="reader" style={{ display: scannerState === 'scanning' ? 'block' : 'none' }} className="w-full max-w-sm border-2"></div>
                        {scannerState === 'idle' && (
                           <button onClick={handleStartScanner} className="flex flex-col items-center text-primary"><CameraIcon /><span className="text-xl">เริ่มสแกน</span></button>
                        )}
                    </>
                )}
                
                {searchMode === 'manual' && scannerState === 'idle' && (
                    <form onSubmit={handleManualSearch} className="w-full space-y-4">
                      <input type="tel" value={nationalIdInput} onChange={e => setNationalIdInput(e.target.value)} required pattern="\d{13}" placeholder="เลขบัตรประชาชน 13 หลัก" className="w-full p-2 border rounded"/>
                      <button type="submit" className="w-full py-2 bg-purple-600 text-white font-semibold rounded">ค้นหา</button>
                    </form>
                )}

                {scannerState === 'found' && foundData && (
                  <div className="w-full">
                    <h2 className="text-2xl font-bold mb-4">ข้อมูลผู้ลงทะเบียน</h2>
                    <div className="p-4 bg-gray-50 rounded border">
                      <p><strong>ชื่อ:</strong> {foundData.registration.fullName}</p>
                      <p><strong>สถานะ:</strong> {foundData.registration.status}</p>
                    </div>
                    <form onSubmit={handleConfirm} className="mt-4">
                      {scanMode === 'check-in' && selectedActivity.type !== 'queue' && (
                          <div>
                            <label>เลขที่นั่ง</label>
                            <input type="text" value={seatNumberInput} onChange={e => setSeatNumberInput(e.target.value)} required className="w-full p-2 border rounded"/>
                          </div>
                      )}
                      <button type="submit" className={`w-full py-3 mt-2 text-white font-semibold rounded ${scanMode === 'check-in' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {scanMode === 'check-in' ? 'ยืนยันเช็คอิน' : 'ยืนยันจบกิจกรรม'}
                      </button>
                    </form>
                  </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}