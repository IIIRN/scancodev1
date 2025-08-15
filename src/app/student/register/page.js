'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, addDoc, query, where, serverTimestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import useLiff from '../../../hooks/useLiff';
import Link from 'next/link';
// 👇 1. Import ฟังก์ชันสำหรับสร้าง Flex Message เข้ามา
import { createRegistrationSuccessFlex } from '../../../lib/flexMessageTemplates';

// ... (ส่วน RegistrationComponent) ...
function RegistrationComponent() {
  const { liffProfile, studentDbProfile, isLoading, error } = useLiff();
  const searchParams = useSearchParams();
  const activityIdFromUrl = searchParams.get('activityId');

  const [activity, setActivity] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!liffProfile || !activityIdFromUrl) return;

    const fetchActivity = async () => {
      const activityDoc = await getDoc(doc(db, 'activities', activityIdFromUrl));
      if (activityDoc.exists()) {
        setActivity({ id: activityDoc.id, ...activityDoc.data() });
      }
    };

    const checkExistingRegistration = async () => {
      const q = query(
        collection(db, 'registrations'),
        where('lineUserId', '==', liffProfile.userId),
        where('activityId', '==', activityIdFromUrl)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setRegistration({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    };

    fetchActivity();
    checkExistingRegistration();
  }, [liffProfile, activityIdFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!studentDbProfile) {
      setMessage('เกิดข้อผิดพลาด: ไม่พบข้อมูลโปรไฟล์นักเรียน');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    
    const registrationData = {
      fullName: studentDbProfile.fullName,
      studentId: studentDbProfile.studentId,
      nationalId: studentDbProfile.nationalId,
      activityId: activityIdFromUrl,
      courseId: activity?.courseId,
      lineUserId: liffProfile.userId,
      status: 'registered',
      seatNumber: null,
      registeredAt: serverTimestamp(),
    };
    
    try {
      const docRef = await addDoc(collection(db, 'registrations'), registrationData);
      
      // 👇 2. เรียกใช้ฟังก์ชันเพื่อสร้าง Flex Message
      const flexMessage = createRegistrationSuccessFlex({
          activityName: activity?.name,
          fullName: studentDbProfile.fullName
      });

      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: liffProfile.userId, flexMessage: flexMessage })
      });
      
      setRegistration({ id: docRef.id, ...registrationData });
    } catch (error) {
      console.error("Error during registration:", error);
      setMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ... (ส่วนที่เหลือของ Component ไม่มีการเปลี่ยนแปลง) ...
  if (isLoading) return <div className="text-center p-10">กำลังโหลด...</div>;
  if (error) return <div className="p-4 text-center text-red-600 bg-red-100">{error}</div>;

  if (registration) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-2">คุณได้ลงทะเบียนกิจกรรมนี้แล้ว</h2>
          <p className="text-gray-600 mb-6">สามารถแสดง QR Code นี้เพื่อเช็คอินได้เลย</p>
          <div className="p-4 bg-white border inline-block rounded-lg shadow">
            <QRCodeSVG value={registration.id} size={240} />
          </div>
        </div>
      </div>
    );
  }

  if (!studentDbProfile) {
    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-2">กรุณาตั้งค่าโปรไฟล์ก่อน</h2>
                <p className="text-gray-600 mb-6">เราต้องการข้อมูลเพิ่มเติมจากคุณก่อนทำการลงทะเบียนกิจกรรม</p>
                <Link href="/student/my-registrations" className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                    ไปที่หน้าตั้งค่าโปรไฟล์
                </Link>
            </div>
        </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">ยืนยันการลงทะเบียน</h2>
        <div className="bg-gray-50 p-4 rounded-lg border space-y-2">
          <p><strong>กิจกรรม:</strong> {activity?.name || 'กำลังโหลด...'}</p>
          <hr/>
          <p><strong>ชื่อ-สกุล:</strong> {studentDbProfile.fullName}</p>
          <p><strong>รหัสนักศึกษา:</strong> {studentDbProfile.studentId}</p>
        </div>
        <p className="text-xs text-gray-500 mt-4">กรุณาตรวจสอบข้อมูลด้านบนให้ถูกต้อง หากต้องการแก้ไขโปรดไปที่หน้า &quot;การลงทะเบียนของฉัน&quot;</p>
        
        {message && <p className="text-red-500 text-sm text-center my-4">{message}</p>}

        <button type="submit" disabled={isSubmitting || !activity} className="w-full mt-6 py-3 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400">
          {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการลงทะเบียน'}
        </button>
      </form>
    </div>
  );
}

// Component หลักที่ครอบด้วย Suspense (เหมือนเดิม)
export default function LiffStudentRegistrationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">กำลังโหลด...</div>}>
      <RegistrationComponent />
    </Suspense>
  );
}