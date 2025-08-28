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
    
    const [ratings, setRatings] = useState({ q1: 0, q2: 0, q3: 0 });
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    
    const questions = [
        "ความพึงพอใจโดยรวม",
        "ความรู้ที่ได้รับ",
        "การจัดกิจกรรม"
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setMessage('');

        if (Object.values(ratings).some(r => r === 0)) {
            setMessage('กรุณาให้คะแนนครบทุกข้อ');
            setIsSubmitting(false);
            return;
        }

        try {
            await addDoc(collection(db, 'evaluations'), {
                activityId,
                userId: liffProfile?.userId || 'unknown',
                ratings,
                comment,
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
                {questions.map((q, i) => (
                    <div key={i}>
                        <p className="font-semibold">{i + 1}. {q}</p>
                        <div className="flex justify-center gap-2 mt-2">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button 
                                    key={star} 
                                    type="button"
                                    onClick={() => setRatings({...ratings, [`q${i+1}`]: star})}
                                    className={`text-3xl ${star <= ratings[`q${i+1}`] ? 'text-yellow-400' : 'text-gray-300'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                <div>
                    <label className="font-semibold">ข้อเสนอแนะเพิ่มเติม:</label>
                    <textarea 
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        className="w-full mt-2 p-2 border rounded"
                        rows="3"
                    ></textarea>
                </div>
                {message && <p className="text-center">{message}</p>}
                <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    {isSubmitting ? 'กำลังส่ง...' : 'ส่งแบบประเมิน'}
                </button>
            </form>
        </div>
    );
}