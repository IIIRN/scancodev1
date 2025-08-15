'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useLiff from '../hooks/useLiff';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useStudentContext } from '../context/StudentContext';
import Image from 'next/image'; // Add import

// --- Modal Component for Linking Profile ---
const LinkProfileModal = ({ liffProfile, onClose, onProfileLinked }) => {
    const [nationalId, setNationalId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        try {
            const regQuery = query(
                collection(db, 'registrations'),
                where("nationalId", "==", nationalId.trim()),
                where("lineUserId", "==", null)
            );
            const regSnapshot = await getDocs(regQuery);

            if (regSnapshot.empty) {
                throw new Error("ไม่พบข้อมูลการลงทะเบียนที่ยังไม่ได้เชื่อมต่อด้วยเลขบัตรประชาชนนี้");
            }

            const firstReg = regSnapshot.docs[0].data();
            const profileData = {
                fullName: firstReg.fullName,
                studentId: firstReg.studentId,
                nationalId: firstReg.nationalId,
                createdAt: serverTimestamp()
            };
            const studentDocRef = doc(db, 'studentProfiles', liffProfile.userId);
            await setDoc(studentDocRef, profileData);

            const batch = writeBatch(db);
            regSnapshot.forEach(doc => {
                batch.update(doc.ref, { lineUserId: liffProfile.userId });
            });
            await batch.commit();

            alert('เชื่อมต่อบัญชีสำเร็จ!');
            onProfileLinked(profileData);
            onClose();

        } catch (err) {
            setError(err.message);
            console.error("Linking error:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm font-sans">
                <h2 className="text-xl font-bold mb-2 text-gray-800">เชื่อมข้อมูลโปรไฟล์</h2>
                <p className="text-sm text-gray-600 mb-4">กรอกเลขบัตรประชาชนเพื่อเชื่อมต่อกับข้อมูลการลงทะเบียนของคุณ</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="tel" placeholder="เลขบัตรประชาชน (13 หลัก)" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required pattern="\d{13}" className="w-full p-3 border border-gray-300 rounded-md"/>
                    {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">ยกเลิก</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-blue-300 hover:bg-blue-700">
                            {isSubmitting ? 'กำลังเชื่อม...' : 'ยืนยัน'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Main Header Component ---
export default function StudentHeader() {
  const { liffProfile, studentDbProfile, isLoading, setStudentDbProfile } = useLiff();
  const { isLinkModalOpen, setIsLinkModalOpen } = useStudentContext();
  const pathname = usePathname();

  const navLinks = [
    { name: 'ค้นหากิจกรรม', href: '/student/activities' },
    { name: 'การลงทะเบียนของฉัน', href: '/student/my-registrations' },
  ];

  if (isLoading || !liffProfile) {
    return (
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 shadow-md text-white animate-pulse">
        <div className="max-w-4xl mx-auto"><div className="h-28"></div></div>
      </header>
    );
  }

  const displayName = studentDbProfile?.fullName || liffProfile?.displayName;
  const displaySubText = studentDbProfile?.studentId ? `ID: ${studentDbProfile.studentId}` : "ยังไม่ได้เชื่อมข้อมูล";

  return (
    <>
      {isLinkModalOpen && (
        <LinkProfileModal
          liffProfile={liffProfile}
          onClose={() => setIsLinkModalOpen(false)}
          onProfileLinked={(newProfile) => setStudentDbProfile(newProfile)}
        />
      )}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 shadow-md text-white sticky top-0 z-40 font-sans">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
<Image
    src={liffProfile?.pictureUrl}
    alt={displayName || 'Profile'}
    width={56} // Specify width
    height={56} // Specify height
    className="w-14 h-14 rounded-full border-2 border-white/80 bg-gray-400"
  />            <div>
              <h1 className="font-bold text-lg">{displayName}</h1>
              <p className="text-xs text-white/80">{displaySubText}</p>
            </div>
          </div>

          {!isLoading && !studentDbProfile && (
            <button onClick={() => setIsLinkModalOpen(true)} className="w-full text-center py-2 mb-4 bg-yellow-400 text-yellow-900 font-bold rounded-lg text-sm hover:bg-yellow-300 transition-colors">
              คลิกเพื่อเชื่อมข้อมูลโปรไฟล์ของคุณ
            </button>
          )}

          <div className="flex justify-center bg-black/20 rounded-lg p-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.name} href={link.href} className={`w-1/2 text-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${isActive ? 'bg-white text-blue-700 shadow' : 'text-white/80 hover:bg-white/10'}`}>
                  {link.name}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
    </>
  );
}