'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useLiff from '../hooks/useLiff';
import Image from 'next/image';

// --- Main Header Component ---
export default function StudentHeader() {
  // 👇 1. นำ state และฟังก์ชันที่เกี่ยวกับ Modal ออก
  const { liffProfile, studentDbProfile, isLoading } = useLiff();
  const pathname = usePathname();

  const navLinks = [
    { name: 'ค้นหากิจกรรม', href: '/student/activities' },
    { name: 'การลงทะเบียนของฉัน', href: '/student/my-registrations' },
  ];

  if (isLoading || !liffProfile) {
    return (
      <header className="bg-primary p-4 shadow-md text-white animate-pulse">
        <div className="max-w-4xl mx-auto"><div className="h-28"></div></div>
      </header>
    );
  }

  const displayName = studentDbProfile?.fullName || liffProfile?.displayName;
  // 👇 2. ปรับข้อความสำหรับผู้ใช้ที่ยังไม่มีโปรไฟล์
  const displaySubText = studentDbProfile?.studentId ? `ID: ${studentDbProfile.studentId}` : "ยังไม่ตั้งค่าโปรไฟล์";

  return (
    <>
      {/* Modal ถูกลบออกไปจากส่วนนี้ */}
      <header className="bg-primary p-4 shadow-md text-white sticky top-0 z-40 font-sans">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Image
                src={liffProfile?.pictureUrl}
                alt={displayName || 'Profile'}
                width={56}
                height={56}
                className="w-14 h-14 rounded-full border-2 border-white/80 bg-gray-400"
            />
            <div>
              <h1 className="font-bold text-lg">{displayName}</h1>
              <p className="text-xs text-white/80">{displaySubText}</p>
            </div>
          </div>

          {/* 👇 3. ปุ่มสำหรับเชื่อมข้อมูลถูกลบออก */}

          <div className="flex justify-center bg-black/40 rounded-lg p-1">
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