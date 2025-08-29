'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';

// ✅ New ToggleSwitch Component
const ToggleSwitch = ({ label, enabled, onChange }) => (
    <label className="flex items-center justify-between cursor-pointer">
        <span className="text-gray-700">{label}</span>
        <div className="relative">
            <input type="checkbox" className="sr-only" checked={enabled} onChange={onChange} />
            <div className={`block w-14 h-8 rounded-full ${enabled ? 'bg-primary' : 'bg-gray-300'}`}></div>
            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${enabled ? 'transform translate-x-6' : ''}`}></div>
        </div>
    </label>
);

export default function SettingsPage() {
    const [courses, setCourses] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [newCourse, setNewCourse] = useState('');
    const [newTimeSlot, setNewTimeSlot] = useState('');

    // ✅ State for notification settings
    const [notificationSettings, setNotificationSettings] = useState({
        onCheckIn: true,
        onCheckOut: true,
        onQueueCall: true,
    });

    useEffect(() => {
        // Fetch Courses and TimeSlots
        const unsubCourses = onSnapshot(collection(db, 'courseOptions'), (snapshot) => {
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubTimeSlots = onSnapshot(collection(db, 'timeSlotOptions'), (snapshot) => {
            setTimeSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        // ✅ Fetch Notification Settings
        const settingsRef = doc(db, 'systemSettings', 'notifications');
        const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setNotificationSettings(docSnap.data());
            }
        });

        return () => {
            unsubCourses();
            unsubTimeSlots();
            unsubSettings();
        };
    }, []);

    // ✅ Function to handle toggle change
    const handleSettingChange = async (settingKey, value) => {
        const newSettings = { ...notificationSettings, [settingKey]: value };
        setNotificationSettings(newSettings);
        const settingsRef = doc(db, 'systemSettings', 'notifications');
        await setDoc(settingsRef, newSettings, { merge: true });
    };

    const handleAddItem = async (type, value) => {
        if (!value.trim()) return;
        const collectionName = type === 'course' ? 'courseOptions' : 'timeSlotOptions';
        await addDoc(collection(db, collectionName), {
            name: value,
            createdAt: serverTimestamp()
        });
        if (type === 'course') setNewCourse('');
        if (type === 'timeSlot') setNewTimeSlot('');
    };

    const handleDeleteItem = async (type, id) => {
        const collectionName = type === 'course' ? 'courseOptions' : 'timeSlotOptions';
        await deleteDoc(doc(db, collectionName, id));
    };

    return (
        <div className="container mx-auto p-4 md:p-8 font-sans">
            <h1 className="text-2xl font-bold mb-6">ตั้งค่าระบบ</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* ✅ Notification Settings Column */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4">การแจ้งเตือน LINE</h2>
                    <div className="space-y-4">
                        <ToggleSwitch 
                            label="แจ้งเตือนเมื่อเช็คอิน"
                            enabled={notificationSettings.onCheckIn}
                            onChange={(e) => handleSettingChange('onCheckIn', e.target.checked)}
                        />
                        <ToggleSwitch 
                            label="แจ้งเตือนเมื่อจบกิจกรรม (ส่งแบบประเมิน)"
                            enabled={notificationSettings.onCheckOut}
                            onChange={(e) => handleSettingChange('onCheckOut', e.target.checked)}
                        />
                        <ToggleSwitch 
                            label="แจ้งเตือนเมื่อเรียกคิว"
                            enabled={notificationSettings.onQueueCall}
                            onChange={(e) => handleSettingChange('onQueueCall', e.target.checked)}
                        />
                    </div>
                </div>

                {/* Courses Column */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-2">หลักสูตร</h2>
                    <div className="flex gap-2 mb-4">
                        <input type="text" value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="เพิ่มหลักสูตรใหม่" className="p-2 border rounded flex-grow" />
                        <button onClick={() => handleAddItem('course', newCourse)} className="px-4 py-2 bg-blue-500 text-white rounded">เพิ่ม</button>
                    </div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {courses.map(course => (
                            <li key={course.id} className="p-2 border rounded flex justify-between items-center">
                                {course.name}
                                <button onClick={() => handleDeleteItem('course', course.id)} className="text-red-500">ลบ</button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Time Slots Column */}
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-2">ช่วงเวลา</h2>
                    <div className="flex gap-2 mb-4">
                        <input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="p-2 border rounded flex-grow" />
                        <button onClick={() => handleAddItem('timeSlot', newTimeSlot)} className="px-4 py-2 bg-blue-500 text-white rounded">เพิ่ม</button>
                    </div>
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                        {timeSlots.map(ts => (
                            <li key={ts.id} className="p-2 border rounded flex justify-between items-center">
                                {ts.name}
                                <button onClick={() => handleDeleteItem('timeSlot', ts.id)} className="text-red-500">ลบ</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}