'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../../../lib/firebase';
import {
  doc, getDoc, collection, query, where, onSnapshot, updateDoc, writeBatch, serverTimestamp, addDoc, deleteDoc, orderBy, limit
} from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createQueueCallFlex } from '../../../../../lib/flexMessageTemplates';

// New component for the insert queue form
const InsertQueueForm = ({ onConfirm, onCancel }) => {
    const [queueNumber, setQueueNumber] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (queueNumber) {
            onConfirm(queueNumber); // Pass as string to handle prefixes like "AS1"
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mt-4 p-4 bg-gray-100 rounded-lg flex gap-2 items-center">
            <input
                type="text" // Changed to text to allow prefixes
                value={queueNumber}
                onChange={(e) => setQueueNumber(e.target.value.toUpperCase())} // Auto uppercase for prefixes
                placeholder="กรอกหมายเลขคิว (เช่น AS1)"
                className="p-2 border rounded-md w-full"
                autoFocus
            />
            <button type="submit" className="px-4 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-hover">ยืนยัน</button>
            <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">ยกเลิก</button>
        </form>
    );
};


export default function QueueCallPage() {
    const params = useParams();
    const { id: activityId } = params;
    const [activity, setActivity] = useState(null);
    const [channels, setChannels] = useState([]);
    const [registrants, setRegistrants] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [publicUrl, setPublicUrl] = useState('');
    const [insertingOnChannel, setInsertingOnChannel] = useState(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPublicUrl(`${window.location.origin}/queue/${activityId}`);
        }
    }, [activityId]);

    const fetchData = useCallback(async () => {
        if (!activityId) return;
        setIsLoading(true);
        
        const activityRef = doc(db, 'activities', activityId);
        const activitySnap = await getDoc(activityRef);
        if (activitySnap.exists()) setActivity({ id: activitySnap.id, ...activitySnap.data() });

        const unsubChannels = onSnapshot(query(collection(db, 'queueChannels'), where('activityId', '==', activityId), orderBy('channelNumber')), (snap) => {
            const channelData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChannels(channelData);
        });

        const unsubRegistrants = onSnapshot(query(collection(db, 'registrations'), where('activityId', '==', activityId)), (snap) => {
            const regData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setRegistrants(regData);
            const courses = [...new Set(regData.map(r => r.course).filter(Boolean))];
            setCourseOptions(courses);
        });
        
        setIsLoading(false);
        return () => {
            unsubChannels();
            unsubRegistrants();
        };
    }, [activityId]);

    useEffect(() => {
        const unsubscribe = fetchData();
        return () => unsubscribe.then(u => u && u());
    }, [fetchData]);
    
    const findLineUserId = async (nationalId) => {
        if (!nationalId) return null;
        const profileQuery = query(collection(db, 'studentProfiles'), where("nationalId", "==", nationalId), limit(1));
        const profileSnapshot = await getDocs(profileQuery);
        if (!profileSnapshot.empty) {
            return profileSnapshot.docs[0].data().lineUserId;
        }
        return null;
    };

    const handleChannelUpdate = async (channelId, field, value) => {
        const channelRef = doc(db, 'queueChannels', channelId);
        await updateDoc(channelRef, { [field]: value });
    };

    const handleAddChannel = async () => {
        const maxChannelNum = channels.reduce((max, ch) => Math.max(max, ch.channelNumber), 0);
        await addDoc(collection(db, 'queueChannels'), {
            activityId,
            channelNumber: maxChannelNum + 1,
            channelName: `ช่องบริการ ${maxChannelNum + 1}`,
            currentQueueNumber: null,
            currentDisplayQueueNumber: null, // ✅ Initialize new field
            currentStudentName: null,
            servingCourse: null,
            createdAt: serverTimestamp(),
        });
    };

    const handleDeleteChannel = async (channelId) => {
        if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบช่องบริการนี้?')) {
            await deleteDoc(doc(db, 'queueChannels', channelId));
        }
    };
    
    // ✅ Centralized function for calling any specific registrant
    const callSpecificRegistrant = async (channel, registrant) => {
         try {
            const settingsRef = doc(db, 'systemSettings', 'notifications');
            const settingsSnap = await getDoc(settingsRef);
            const settings = settingsSnap.exists() ? settingsSnap.data() : { onQueueCall: true };
            
            const batch = writeBatch(db);
            const channelRef = doc(db, 'queueChannels', channel.id);
            // ✅ Update with both numeric and display queue numbers
            batch.update(channelRef, { 
                currentQueueNumber: registrant.queueNumber,
                currentDisplayQueueNumber: registrant.displayQueueNumber,
                currentStudentName: registrant.fullName
            });
            const regRef = doc(db, 'registrations', registrant.id);
            batch.update(regRef, { calledAt: serverTimestamp() });
            await batch.commit();

            const lineUserId = registrant.lineUserId || await findLineUserId(registrant.nationalId);
            if (settings.onQueueCall && lineUserId) {
                const flexMessage = createQueueCallFlex({
                    activityName: activity.name,
                    channelName: channel.channelName || `ช่องบริการ ${channel.channelNumber}`,
                    queueNumber: registrant.displayQueueNumber, // ✅ Use display number for notification
                    courseName: registrant.course,
                });
                
                const response = await fetch('/api/send-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: lineUserId, flexMessage }) });
                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.message || 'API Error');
                }
            } else if (settings.onQueueCall && !lineUserId) {
                alert('เรียกคิวสำเร็จ แต่ไม่สามารถส่งแจ้งเตือนได้เนื่องจากไม่พบ LINE User ID ของผู้ใช้');
            }
        } catch (error) {
            console.error("Error calling queue:", error);
            alert(`เกิดข้อผิดพลาดในการเรียกคิว: ${error.message}`);
        }
    };
    
    const handleCallNext = async (channel) => {
        if (!channel.servingCourse) {
            alert('กรุณาเลือกหลักสูตรสำหรับช่องบริการนี้ก่อน');
            return;
        }
        const waitingForCourse = registrants.filter(r => r.course === channel.servingCourse && r.status === 'checked-in' && !r.calledAt).sort((a, b) => a.queueNumber - b.queueNumber);
        if (waitingForCourse.length === 0) {
            alert(`ไม่มีคิวรอสำหรับหลักสูตร: ${channel.servingCourse}`);
            return;
        }
        const nextInQueue = waitingForCourse[0];
        await callSpecificRegistrant(channel, nextInQueue);
    };
    
    const handleRecall = async (channel) => {
        if (!channel.currentQueueNumber) {
            alert('ยังไม่มีคิวที่ถูกเรียกในช่องนี้');
            return;
        }
        const currentRegistrant = registrants.find(r => r.queueNumber === channel.currentQueueNumber && r.course === channel.servingCourse);
        if (!currentRegistrant) {
            alert(`ไม่พบข้อมูลผู้ลงทะเบียนสำหรับคิวที่ ${channel.currentQueueNumber}`);
            return;
        }
        await callSpecificRegistrant(channel, currentRegistrant);
        alert(`ส่งแจ้งเตือนเรียกคิว ${currentRegistrant.displayQueueNumber} ซ้ำอีกครั้งสำเร็จ!`);
    };

    const handleInsertQueue = async (channel, displayQueueNumber) => {
        const registrantToCall = registrants.find(r => r.displayQueueNumber === displayQueueNumber && r.status === 'checked-in');
        if (!registrantToCall) {
            alert(`ไม่พบคิว ${displayQueueNumber} ที่ได้ทำการเช็คอินไว้`);
            setInsertingOnChannel(null);
            return;
        }
        await callSpecificRegistrant(channel, registrantToCall);
        alert(`แทรกคิว ${displayQueueNumber} สำเร็จ`);
        setInsertingOnChannel(null);
    };


    if (isLoading) return <p className="text-center p-8 font-sans">กำลังโหลด...</p>;
    
    const waitingByCourse = courseOptions.reduce((acc, course) => {
        acc[course] = registrants.filter(r => r.course === course && r.status === 'checked-in' && !r.calledAt).length;
        return acc;
    }, {});

    return (
        <div className="bg-gray-100 min-h-screen">
            <main className="container mx-auto p-4 md:p-8">
                <h1 className="text-3xl font-bold mb-6 text-gray-800">เรียกคิวสำหรับ: {activity?.name}</h1>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Channels */}
                    <div className="lg:col-span-2">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-semibold text-gray-700">ช่องเรียกคิว</h2>
                            <button onClick={handleAddChannel} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition-colors">
                                + เพิ่มช่องบริการ
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {channels.map(channel => (
                                <div key={channel.id} className="bg-white p-5 border rounded-lg shadow-md flex flex-col space-y-4">
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">ชื่อช่องบริการ</label>
                                            <input type="text" defaultValue={channel.channelName || `ช่องบริการ ${channel.channelNumber}`} onBlur={e => handleChannelUpdate(channel.id, 'channelName', e.target.value)} className="w-full mt-1 p-2 border rounded-md" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-600">หลักสูตรที่รับผิดชอบ</label>
                                            <select value={channel.servingCourse || ''} onChange={e => handleChannelUpdate(channel.id, 'servingCourse', e.target.value)} className="w-full mt-1 p-2 border rounded-md bg-white">
                                                <option value="">-- เลือกหลักสูตร --</option>
                                                {courseOptions.map(course => <option key={course} value={course}>{course}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                                        <p className="text-sm text-gray-500">คิวปัจจุบัน</p>
                                        {/* ✅ Display the prefixed queue number */}
                                        <p className="text-5xl font-bold text-primary my-1">{channel.currentDisplayQueueNumber || '-'}</p>
                                        <p className="text-lg text-gray-700 h-7 truncate">{channel.currentStudentName || '-'}</p>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <button onClick={() => handleCallNext(channel)} className="md:col-span-2 w-full py-3 bg-primary text-white font-bold rounded-md hover:bg-primary-hover disabled:bg-gray-400 transition-colors" disabled={!channel.servingCourse}>เรียกคิวถัดไป</button>
                                        <button onClick={() => handleRecall(channel)} className="py-3 px-4 bg-card text-white rounded-md hover:opacity-90 disabled:bg-gray-400 transition-colors" disabled={!channel.currentQueueNumber}>เรียกซ้ำ</button>
                                        <button onClick={() => setInsertingOnChannel(channel.id)} className="py-3 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">แทรกคิว</button>
                                    </div>
                                    {insertingOnChannel === channel.id && (
                                        <InsertQueueForm 
                                            onConfirm={(queueNumber) => handleInsertQueue(channel, queueNumber)}
                                            onCancel={() => setInsertingOnChannel(null)}
                                        />
                                    )}
                                    <div className="pt-2 text-right">
                                         <button onClick={() => handleDeleteChannel(channel.id)} className="text-xs text-red-500 hover:text-red-700 hover:underline">ลบช่องบริการนี้</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Summary */}
                    <div className="lg:col-span-1 space-y-6">
                        <h2 className="text-2xl font-semibold text-gray-700">ข้อมูลสรุป</h2>
                        <div className="bg-white p-5 border rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold mb-3">ลิงก์สำหรับแสดงผลคิว</h3>
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-white border inline-block rounded-lg shadow-sm"><QRCodeSVG value={publicUrl} size={100} /></div>
                                <div>
                                    <p className="text-sm text-gray-500">ใช้สำหรับแสดงผลบนจอสาธารณะ</p>
                                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 break-all text-sm">{publicUrl}</a>
                                </div>
                            </div>
                        </div>

                         <div className="bg-white p-5 border rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold mb-3">คิวที่รอเรียก</h3>
                             <div className="space-y-2">
                                {courseOptions.length > 0 ? courseOptions.map(course => (
                                    <div key={course} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <span className="font-medium text-gray-700">{course}:</span> 
                                        <span className="font-bold text-primary">{waitingByCourse[course] || 0} คิว</span>
                                    </div>
                                )) : <p className="text-sm text-gray-500 text-center">ยังไม่มีข้อมูลคิว</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}