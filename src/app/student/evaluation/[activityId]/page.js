'use client';

import { useState } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import useLiff from '../../../../hooks/useLiff';

export default function EvaluationPage() {
    const params = useParams();
    const router = useRouter();
    const { activityId } = params;
    const { liffProfile } = useLiff();
    
    // New state for the new questions
    const [satisfaction, setSatisfaction] = useState('');
    const [source, setSource] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    
    const satisfactionOptions = [
        "มากที่สุด",
        "มาก",
        "ปานกลาง",
        "น้อย",
        "ควรปรับปรุง"
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        if (!satisfaction || !source.trim()) {
            setMessage('กรุณากรอกข้อมูลให้ครบทุกข้อ');
            setIsSubmitting(false);
            return;
        }

        try {
            await addDoc(collection(db, 'evaluations'), {
                activityId,
                userId: liffProfile?.userId || 'unknown',
                satisfaction: satisfaction, // Save the satisfaction level
                source: source.trim(), // Save the source text
                submittedAt: serverTimestamp()
            });
            setMessage('ขอบคุณสำหรับการประเมิน!');
            setTimeout(() => router.push('/student/my-registrations'), 2000);
        } catch (error) {
            setMessage('เกิดข้อผิดพลาดในการส่งข้อมูล');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4">แบบประเมินกิจกรรม</h1>
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
                <div>
                    <p className="font-semibold">1. ความพึงพอใจโดยรวมต่อกระบวนการรับสมัคร</p>
                    <div className="mt-2 space-y-2">
                        {satisfactionOptions.map((option) => (
                            <label key={option} className="flex items-center p-3 border rounded-md has-[:checked]:bg-blue-50 has-[:checked]:border-primary cursor-pointer">
                                <input 
                                    type="radio"
                                    name="satisfaction"
                                    value={option}
                                    checked={satisfaction === option}
                                    onChange={(e) => setSatisfaction(e.target.value)}
                                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                                />
                                <span className="ml-3 text-gray-700">{option}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="font-semibold">2. ท่านทราบข้อมูลการรับสมัครจากช่องทางใด</label>
                    <textarea 
                        value={source}
                        onChange={e => setSource(e.target.value)}
                        className="w-full mt-2 p-2 border rounded"
                        rows="3"
                        placeholder="ระบุช่องทาง..."
                        required
                    ></textarea>
                </div>
                {message && <p className="text-center font-bold text-green-600">{message}</p>}
                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover disabled:bg-gray-400">
                    {isSubmitting ? 'กำลังส่ง...' : 'ส่งแบบประเมิน'}
                </button>
            </form>
        </div>
    );
}