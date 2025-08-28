'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useParams } from 'next/navigation';

export default function EvaluationResultPage() {
    const params = useParams();
    const { activityId } = params;
    const [activity, setActivity] = useState(null);
    const [evaluations, setEvaluations] = useState([]);
    const [averages, setAverages] = useState({ q1: 0, q2: 0, q3: 0 });
    const [isLoading, setIsLoading] = useState(true);

    const questions = [
        "ความพึงพอใจโดยรวม",
        "ความรู้ที่ได้รับ",
        "การจัดกิจกรรม"
    ];

    useEffect(() => {
        const fetchData = async () => {
            if (!activityId) return;
            setIsLoading(true);

            // Fetch Activity Details
            const activityRef = doc(db, 'activities', activityId);
            const activitySnap = await getDoc(activityRef);
            if (activitySnap.exists()) {
                setActivity(activitySnap.data());
            }

            // Fetch Evaluations
            const q = query(collection(db, 'evaluations'), where('activityId', '==', activityId));
            const querySnapshot = await getDocs(q);
            const evals = querySnapshot.docs.map(doc => doc.data());
            setEvaluations(evals);

            // Calculate Averages
            if (evals.length > 0) {
                const total = evals.reduce((acc, curr) => {
                    return {
                        q1: acc.q1 + curr.ratings.q1,
                        q2: acc.q2 + curr.ratings.q2,
                        q3: acc.q3 + curr.ratings.q3,
                    }
                }, { q1: 0, q2: 0, q3: 0 });

                setAverages({
                    q1: (total.q1 / evals.length).toFixed(2),
                    q2: (total.q2 / evals.length).toFixed(2),
                    q3: (total.q3 / evals.length).toFixed(2),
                });
            }
            setIsLoading(false);
        };
        fetchData();
    }, [activityId]);

    if (isLoading) return <p className="text-center p-8">กำลังโหลดข้อมูลการประเมิน...</p>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-2xl font-bold">ผลการประเมิน</h1>
            <h2 className="text-xl text-gray-600 mb-6">{activity?.name}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {questions.map((q, i) => (
                    <div key={i} className="bg-white p-4 rounded-lg shadow text-center">
                        <h3 className="font-semibold">{q}</h3>
                        <p className="text-3xl font-bold text-blue-600">{averages[`q${i+1}`]}</p>
                        <p className="text-sm text-gray-500">คะแนนเฉลี่ย</p>
                    </div>
                ))}
            </div>

            <div>
                <h2 className="text-xl font-semibold mb-2">ข้อเสนอแนะทั้งหมด ({evaluations.filter(e => e.comment).length})</h2>
                <div className="space-y-2">
                    {evaluations.map((e, i) => e.comment && (
                        <p key={i} className="p-3 bg-gray-100 border rounded">{e.comment}</p>
                    ))}
                </div>
            </div>
        </div>
    );
}