'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../../../lib/firebase';
import {
  doc, getDoc, collection, query, where, onSnapshot, updateDoc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

export default function QueueCallPage() {
    const params = useParams();
    const { id: activityId } = params;
    const [activity, setActivity] = useState(null);
    const [channels, setChannels] = useState([]);
    const [registrants, setRegistrants] = useState([]);
    const [courseOptions, setCourseOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [publicUrl, setPublicUrl] = useState('');
    
    // Setup State
    const [isSetupMode, setIsSetupMode] = useState(false);
    const [numChannels, setNumChannels] = useState(1);
    const [channelConfigs, setChannelConfigs] = useState({});

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

        const unsubChannels = onSnapshot(query(collection(db, 'queueChannels'), where('activityId', '==', activityId)), (snap) => {
            const channelData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChannels(channelData.sort((a, b) => a.channelNumber - b.channelNumber));
            if (channelData.length === 0) setIsSetupMode(true);
            
            const initialConfigs = {};
            channelData.forEach(c => { initialConfigs[c.id] = c.servingCourse || '' });
            setChannelConfigs(initialConfigs);
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

    const handleSetupChannels = async () => {
        const batch = writeBatch(db);
        for (let i = 1; i <= numChannels; i++) {
            const channelRef = doc(collection(db, 'queueChannels'));
            batch.set(channelRef, {
                activityId,
                channelNumber: i,
                currentQueueNumber: null,
                currentStudentName: null,
                servingCourse: null,
                createdAt: serverTimestamp(),
            });
        }
        await batch.commit();
        setIsSetupMode(false);
    };
    
    const handleSaveChannelConfig = async () => {
        const batch = writeBatch(db);
        Object.entries(channelConfigs).forEach(([channelId, course]) => {
            const channelRef = doc(db, 'queueChannels', channelId);
            batch.update(channelRef, { servingCourse: course });
        });
        await batch.commit();
        alert('บันทึกการตั้งค่าช่องบริการแล้ว');
    };

    const handleCallNext = async (channel) => {
        const waitingForCourse = registrants.filter(r => 
            r.course === channel.servingCourse &&
            r.status === 'checked-in' &&
            !r.calledAt
        ).sort((a, b) => a.queueNumber - b.queueNumber);

        if (waitingForCourse.length === 0) {
            alert(`ไม่มีคิวรอสำหรับหลักสูตร: ${channel.servingCourse}`);
            return;
        }

        const nextInQueue = waitingForCourse[0];
        const batch = writeBatch(db);
        
        const channelRef = doc(db, 'queueChannels', channel.id);
        batch.update(channelRef, { 
            currentQueueNumber: nextInQueue.queueNumber,
            currentStudentName: nextInQueue.fullName
        });

        const regRef = doc(db, 'registrations', nextInQueue.id);
        batch.update(regRef, { calledAt: serverTimestamp() });

        await batch.commit();
    };

    if (isLoading) return <p className="text-center p-4">กำลังโหลด...</p>;

    if (isSetupMode) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">ตั้งค่าช่องบริการสำหรับ: {activity?.name}</h1>
                <input type="number" value={numChannels} onChange={(e) => setNumChannels(Number(e.target.value))} min="1" className="p-2 border rounded" />
                <button onClick={handleSetupChannels} className="ml-2 px-4 py-2 bg-blue-500 text-white rounded">สร้างช่องบริการ</button>
            </div>
        );
    }
    
    const waitingByCourse = courseOptions.reduce((acc, course) => {
        acc[course] = registrants.filter(r => r.course === course && r.status === 'checked-in' && !r.calledAt).length;
        return acc;
    }, {});

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">เรียกคิวสำหรับ: {activity?.name}</h1>
            
            <div className="mb-6 p-4 border rounded shadow bg-gray-50 space-y-4">
                <div>
                    <h3 className="text-lg font-semibold">ลิงก์สำหรับแสดงผลคิว</h3>
                    <div className="flex items-center gap-4 mt-2">
                        <div className="p-2 bg-white border inline-block rounded-lg shadow"><QRCodeSVG value={publicUrl} size={100} /></div>
                        <div>
                            <p className="text-sm text-gray-600">ใช้ลิงก์หรือ QR Code นี้สำหรับแสดงผลบนจอสาธารณะ</p>
                            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 break-all">{publicUrl}</a>
                        </div>
                    </div>
                </div>
                 <div className="border-t pt-4">
                    <h3 className="text-lg font-semibold">คิวที่รอเรียก</h3>
                     <div className="flex flex-wrap gap-4 mt-2">
                        {courseOptions.map(course => (
                            <div key={course} className="p-2 bg-white border rounded">
                                <span className="font-semibold">{course}:</span> {waitingByCourse[course] || 0} คิว
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channels.map(channel => (
                    <div key={channel.id} className="p-4 border rounded shadow space-y-3">
                        <h2 className="text-xl font-semibold">ช่องบริการที่ {channel.channelNumber}</h2>
                        <div>
                            <label className="text-sm">หลักสูตร:</label>
                            <select 
                                value={channelConfigs[channel.id] || ''} 
                                onChange={e => setChannelConfigs({...channelConfigs, [channel.id]: e.target.value})}
                                className="w-full p-2 border rounded"
                            >
                                <option value="">-- เลือกหลักสูตร --</option>
                                {courseOptions.map(course => <option key={course} value={course}>{course}</option>)}
                            </select>
                        </div>
                        <p className="text-3xl my-2">คิวปัจจุบัน: {channel.currentQueueNumber || '-'}</p>
                        <p className="text-lg my-2 h-8 truncate">ชื่อ: {channel.currentStudentName || '-'}</p>
                        <button onClick={() => handleCallNext(channel)} className="w-full px-4 py-2 bg-green-500 text-white rounded disabled:bg-gray-400" disabled={!channelConfigs[channel.id]}>
                            เรียกคิวถัดไป
                        </button>
                    </div>
                ))}
            </div>
            <div className="mt-6 text-center">
                <button onClick={handleSaveChannelConfig} className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700">
                    บันทึกการตั้งค่าช่องบริการ
                </button>
            </div>
        </div>
    );
}