'use client';

import { useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, limit } from 'firebase/firestore';

export default function ProfileSetupForm({ liffProfile, onProfileCreated }) {
  const [nationalId, setNationalId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const registrationsRef = collection(db, 'registrations');
      const q = query(registrationsRef, where("nationalId", "==", nationalId.trim()), limit(1));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('ไม่พบข้อมูลเลขบัตรประชาชนนี้ในระบบ กรุณาติดต่อเจ้าหน้าที่');
        setIsSubmitting(false);
        return;
      }

      const regData = querySnapshot.docs[0].data();
      const fullNameFromDb = regData.fullName;
      const studentIdFromDb = regData.studentId || null;
      
      const profileData = {
        fullName: fullNameFromDb,
        studentId: studentIdFromDb,
        nationalId: nationalId.trim(),
        lineUserId: liffProfile.userId, // ✅ Save lineUserId to the main profile
        createdAt: serverTimestamp()
      };

      const studentDocRef = doc(db, 'studentProfiles', liffProfile.userId);
      await setDoc(studentDocRef, profileData);
      
      onProfileCreated(profileData);

    } catch (err) {
      setError("เกิดข้อผิดพลาดในการบันทึกโปรไฟล์");
      console.error("Profile creation error:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 md:p-8">
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-2">ตั้งค่าโปรไฟล์นักเรียน</h1>
        <p className="text-gray-600 mb-6">กรุณายืนยันเลขบัตรประชาชนเพื่อเชื่อมต่อกับกิจกรรม</p>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label htmlFor="nationalId" className="block text-sm font-medium text-gray-700">เลขบัตรประชาชน (13 หลัก)</label>
            <input
              id="nationalId"
              type="tel"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              required
              pattern="\d{13}"
              className="mt-1 w-full p-3 border border-gray-300 rounded-md"
              placeholder="กรุณากรอกเลขบัตรประชาชน"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-primary text-white font-bold rounded-md hover:bg-primary-hover transition-colors">
            {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกและเริ่มต้นใช้งาน'}
          </button>
        </form>
      </div>
    </div>
  );
}