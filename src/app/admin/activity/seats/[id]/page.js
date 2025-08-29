'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { db } from '../../../../../lib/firebase';
import {
  doc, getDoc, updateDoc, collection, query,
  where, getDocs, writeBatch, serverTimestamp, deleteDoc, addDoc, onSnapshot, limit
} from 'firebase/firestore';
import Papa from "papaparse";
import { CSVLink } from "react-csv";

// Helper function to translate status to Thai
const translateStatus = (status) => {
  switch (status) {
    case 'checked-in': return 'เช็คอินแล้ว';
    case 'registered': return 'ลงทะเบียนแล้ว';
    default: return status || '';
  }
};

export default function SeatAssignmentPage({ params }) {
  const { id: activityId } = use(params);
  const [activity, setActivity] = useState(null);
  const [registrants, setRegistrants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const [form, setForm] = useState({
    fullName: '', studentId: '', nationalId: '', course: '', timeSlot: ''
  });

  const [editStates, setEditStates] = useState({});
  const [courseOptions, setCourseOptions] = useState([]);
  const [timeSlotOptions, setTimeSlotOptions] = useState([]);

  // ✅ Helper function to find lineUserId from studentProfiles
  const findLineUserId = async (nationalId) => {
    if (!nationalId) return null;
    const profileQuery = query(collection(db, 'studentProfiles'), where("nationalId", "==", nationalId), limit(1));
    const profileSnapshot = await getDocs(profileQuery);
    if (!profileSnapshot.empty) {
        return profileSnapshot.docs[0].data().lineUserId;
    }
    return null;
  };

  useEffect(() => {
    const unsubCourses = onSnapshot(collection(db, 'courseOptions'), (snapshot) => {
        setCourseOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTimeSlots = onSnapshot(collection(db, 'timeSlotOptions'), (snapshot) => {
        setTimeSlotOptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
        unsubCourses();
        unsubTimeSlots();
    };
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const activityDoc = await getDoc(doc(db, 'activities', activityId));
      if (activityDoc.exists()) {
        setActivity({ id: activityDoc.id, ...activityDoc.data() });
      }

      const q = query(collection(db, 'registrations'), where('activityId', '==', activityId));
      const snapshot = await getDocs(q);
      const registrantsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      registrantsData.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      setRegistrants(registrantsData);

      const initialEdits = {};
      registrantsData.forEach(r => {
        initialEdits[r.id] = { 
          seatNumber: r.seatNumber || '', 
          course: r.course || '', 
          timeSlot: r.timeSlot || '' 
        };
      });
      setEditStates(initialEdits);

    } catch (error) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (registrantId, field, value) => {
    setEditStates(prev => ({
      ...prev,
      [registrantId]: { ...prev[registrantId], [field]: value }
    }));
  };

  const handleUpdateRegistrant = async (registrantId) => {
    const dataToUpdate = editStates[registrantId];
    try {
      const registrantDocRef = doc(db, 'registrations', registrantId);
      await updateDoc(registrantDocRef, dataToUpdate);
      setMessage('✅ อัปเดตข้อมูลสำเร็จ');
      setTimeout(() => setMessage(''), 2000);
    } catch (error) {
      setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };
  
  const handleAddParticipant = async (e) => {
      e.preventDefault();
      const { fullName, nationalId, course, timeSlot, studentId } = form;
      if (!fullName || !nationalId || (activity?.type === 'queue' && (!course || !timeSlot))) {
          setMessage('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
          return;
      }

      try {
          const lineUserId = await findLineUserId(nationalId); // ✅ Find existing lineUserId
          await addDoc(collection(db, 'registrations'), {
              activityId,
              courseId: activity?.courseId || null,
              fullName,
              studentId: studentId || null,
              nationalId,
              course: course || null,
              timeSlot: timeSlot || null,
              status: 'registered',
              registeredBy: 'admin_manual_add',
              registeredAt: serverTimestamp(),
              lineUserId: lineUserId, // ✅ Add it here
          });
          setMessage('เพิ่มรายชื่อสำเร็จ!');
          setForm({ fullName: '', studentId: '', nationalId: '', course: '', timeSlot: '' });
          fetchData();
      } catch (error) {
          setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
      }
  };

  const handleDeleteRegistrant = async (registrantId) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?')) {
      try {
        await deleteDoc(doc(db, 'registrations', registrantId));
        setMessage('ลบข้อมูลสำเร็จ');
        fetchData();
      } catch (error) {
        setMessage(`เกิดข้อผิดพลาดในการลบ: ${error.message}`);
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const newRegistrants = results.data;
            setMessage(`กำลังนำเข้าข้อมูล ${newRegistrants.length} รายการ...`);
            
            try {
                const batch = writeBatch(db);
                // ✅ Process each registrant one by one to find their lineUserId
                for (const reg of newRegistrants) {
                    if (reg.fullName && reg.nationalId) {
                        const lineUserId = await findLineUserId(reg.nationalId); // Find lineUserId
                        const newRegRef = doc(collection(db, 'registrations'));
                        batch.set(newRegRef, {
                            activityId,
                            courseId: activity?.courseId || null,
                            fullName: reg.fullName,
                            studentId: reg.studentId || null,
                            nationalId: reg.nationalId,
                            course: reg.course || null,
                            timeSlot: reg.timeSlot || null,
                            status: 'registered',
                            registeredBy: 'admin_csv_import',
                            registeredAt: serverTimestamp(),
                            lineUserId: lineUserId, // Add it here
                        });
                    }
                }
                await batch.commit();
                setMessage(`✅ นำเข้าข้อมูล ${newRegistrants.length} รายการสำเร็จ!`);
                fetchData();
            } catch (error) {
                setMessage(`❌ เกิดข้อผิดพลาดในการนำเข้า: ${error.message}`);
            }
        },
        error: (error) => {
            setMessage(`❌ เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ${error.message}`);
        }
    });
  };

  const csvExportHeaders = [
    { label: "fullName", key: "fullName" },
    { label: "studentId", key: "studentId" },
    { label: "nationalId", key: "nationalId" },
    { label: "course", key: "course" },
    { label: "timeSlot", key: "timeSlot" },
  ];

  const csvExportData = registrants.map(reg => ({
      fullName: reg.fullName || '',
      studentId: reg.studentId || '',
      nationalId: reg.nationalId || '',
      course: reg.course || '',
      timeSlot: reg.timeSlot || '',
  }));

  if (isLoading) return <div className="text-center p-10 font-sans">กำลังโหลด...</div>;

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8 font-sans">
      <main className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">จัดการข้อมูลนักเรียน</h1>
            <p className="text-gray-600">{activity?.name}</p>
          </div>
          <Link href="/admin/activity" className="text-sm text-blue-600 hover:underline">&larr; กลับไปหน้าแดชบอร์ด</Link>
        </div>
        
        {message && <p className="text-center mb-4 font-semibold text-blue-700">{message}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">นำเข้าและส่งออกข้อมูล</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                           นำเข้าไฟล์ CSV (ต้องมี Header: fullName, nationalId)
                        </label>
                        <input 
                            type="file" 
                            accept=".csv" 
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                    <div>
                        <CSVLink
                            data={csvExportData}
                            headers={csvExportHeaders}
                            filename={`import_template_${activityId}.csv`}
                            className="w-full text-center block px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                        >
                            Export ข้อมูลสำหรับ Import
                        </CSVLink>
                    </div>
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-xl font-semibold mb-4">เพิ่มนักเรียนรายบุคคล</h2>
                <form onSubmit={handleAddParticipant} className="space-y-3">
                    <input type="text" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="ชื่อ-สกุล*" className="p-2 border rounded w-full" required />
                    <input type="text" value={form.studentId} onChange={e => setForm({...form, studentId: e.target.value})} placeholder="รหัสนักศึกษา" className="p-2 border rounded w-full" />
                    <input type="text" value={form.nationalId} onChange={e => setForm({...form, nationalId: e.target.value})} placeholder="เลขบัตรประชาชน*" className="p-2 border rounded w-full" required pattern="\d{13}" />
                    {activity?.type === 'queue' && (
                        <>
                            <select value={form.course} onChange={e => setForm({...form, course: e.target.value})} className="p-2 border rounded w-full" required>
                                <option value="">เลือกหลักสูตร*</option>
                                {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            <select value={form.timeSlot} onChange={e => setForm({...form, timeSlot: e.target.value})} className="p-2 border rounded w-full" required>
                                <option value="">เลือกช่วงเวลา*</option>
                                {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                            </select>
                        </>
                    )}
                    <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">เพิ่ม</button>
                </form>
            </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100">
                <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">ชื่อ-สกุล</th>
                    <th className="p-2">รหัส นศ.</th>
                    <th className="p-2">สถานะ</th>
                    {activity?.type === 'queue' ? (
                        <>
                            <th className="p-2">หลักสูตร</th>
                            <th className="p-2">ช่วงเวลา</th>
                        </>
                    ) : (
                        <th className="p-2">เลขที่นั่ง</th>
                    )}
                    <th className="p-2">จัดการ</th>
                </tr>
            </thead>
            <tbody>
                {registrants.map((reg, index) => (
                    <tr key={reg.id} className="border-b hover:bg-gray-50">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2 font-medium">{reg.fullName}</td>
                        <td className="p-2">{reg.studentId}</td>
                        <td className="p-2">{translateStatus(reg.status)}</td>
                        {activity?.type === 'queue' ? (
                            <>
                                <td className="p-2">
                                    <select value={editStates[reg.id]?.course || ''} onChange={(e) => handleInputChange(reg.id, 'course', e.target.value)} className="p-1 border rounded w-full">
                                        <option value="">เลือกหลักสูตร</option>
                                        {courseOptions.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </td>
                                <td className="p-2">
                                    <select value={editStates[reg.id]?.timeSlot || ''} onChange={(e) => handleInputChange(reg.id, 'timeSlot', e.target.value)} className="p-1 border rounded">
                                        <option value="">เลือกเวลา</option>
                                        {timeSlotOptions.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                    </select>
                                </td>
                            </>
                        ) : (
                            <td className="p-2"><input type="text" value={editStates[reg.id]?.seatNumber || ''} onChange={(e) => handleInputChange(reg.id, 'seatNumber', e.target.value)} className="p-1 border rounded w-24"/></td>
                        )}
                        <td className="p-2 flex gap-2">
                            <button onClick={() => handleUpdateRegistrant(reg.id)} className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">บันทึก</button>
                            <button onClick={() => handleDeleteRegistrant(reg.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">ลบ</button>
                        </td>
                    </tr>
                ))}
            </tbody>
          </table>
          {registrants.length === 0 && <p className="p-6 text-center text-gray-500">ยังไม่มีนักเรียนลงทะเบียน</p>}
        </div>
      </main>
    </div>
  );
}