'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export default function SettingsPage() {
    const [courses, setCourses] = useState([]);
    const [timeSlots, setTimeSlots] = useState([]);
    const [newCourse, setNewCourse] = useState('');
    const [newTimeSlot, setNewTimeSlot] = useState('');

    useEffect(() => {
        const unsubCourses = onSnapshot(collection(db, 'courseOptions'), (snapshot) => {
            setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        const unsubTimeSlots = onSnapshot(collection(db, 'timeSlotOptions'), (snapshot) => {
            setTimeSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => {
            unsubCourses();
            unsubTimeSlots();
        };
    }, []);

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
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-6">ตั้งค่าตัวเลือก</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Courses */}
                <div>
                    <h2 className="text-xl font-semibold mb-2">หลักสูตร</h2>
                    <div className="flex gap-2 mb-4">
                        <input type="text" value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="เพิ่มหลักสูตรใหม่" className="p-2 border rounded flex-grow" />
                        <button onClick={() => handleAddItem('course', newCourse)} className="px-4 py-2 bg-blue-500 text-white rounded">เพิ่ม</button>
                    </div>
                    <ul className="space-y-2">
                        {courses.map(course => (
                            <li key={course.id} className="p-2 border rounded flex justify-between items-center">
                                {course.name}
                                <button onClick={() => handleDeleteItem('course', course.id)} className="text-red-500">ลบ</button>
                            </li>
                        ))}
                    </ul>
                </div>
                {/* Time Slots */}
                <div>
                    <h2 className="text-xl font-semibold mb-2">ช่วงเวลา</h2>
                    <div className="flex gap-2 mb-4">
                        <input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} className="p-2 border rounded flex-grow" />
                        <button onClick={() => handleAddItem('timeSlot', newTimeSlot)} className="px-4 py-2 bg-blue-500 text-white rounded">เพิ่ม</button>
                    </div>
                    <ul className="space-y-2">
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