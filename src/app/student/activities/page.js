'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

// Helper component for the person icon
const UsersIcon = () => (
    <svg className="w-4 h-4 inline-block mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.995 5.995 0 003 21m0 0a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197"></path></svg>
);

export default function ActivitiesListPage() {
  const [activities, setActivities] = useState([]);
  const [courses, setCourses] = useState({});
  const [registrationsCount, setRegistrationsCount] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false); // 👈 1. Add mounted state

  // This effect runs only on the client after the component mounts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only fetch data on the client side
    if (!isMounted) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [coursesSnapshot, activitiesSnapshot, registrationsSnapshot] = await Promise.all([
          getDocs(collection(db, 'courses')),
          getDocs(query(collection(db, 'activities'), where("activityDate", ">=", Timestamp.now()))),
          getDocs(collection(db, 'registrations'))
        ]);
        
        const coursesMap = {};
        coursesSnapshot.forEach(doc => { coursesMap[doc.id] = doc.data().name; });
        setCourses(coursesMap);

        const counts = {};
        registrationsSnapshot.forEach(doc => {
          const activityId = doc.data().activityId;
          counts[activityId] = (counts[activityId] || 0) + 1;
        });
        setRegistrationsCount(counts);

        const activitiesList = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActivities(activitiesList);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isMounted]); // 👈 2. Add isMounted as a dependency

  // 👈 3. Don't render anything until mounted on the client
  // This ensures the server and client render the same initial null state.
  if (!isMounted) {
    return null; 
  }

  if (isLoading) {
    return <div className="text-center p-10 font-sans">กำลังโหลดรายการกิจกรรม...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {activities.length === 0 ? (
        <div className="text-center py-10 px-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-700">ไม่มีกิจกรรม</h2>
            <p className="text-gray-500 mt-2">ยังไม่มีกิจกรรมที่เปิดรับสมัครในขณะนี้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activities.map(activity => {
            const activityDate = activity.activityDate.toDate();
            const count = registrationsCount[activity.id] || 0;
            const isFull = count >= activity.capacity;
            const isAlmostFull = !isFull && count / activity.capacity >= 0.9;

            return (
              <div key={activity.id} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col transition-transform hover:scale-105">
                <div className="p-6 flex-grow">
                  <p className="text-sm font-semibold text-indigo-600">{courses[activity.courseId] || 'หลักสูตรทั่วไป'}</p>
                  <h2 className="text-xl font-bold text-gray-900 mt-1 mb-2">{activity.name}</h2>
                  <p className="text-gray-600 text-sm mb-1">
                    <strong>วันที่:</strong> {activityDate.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })} น.
                  </p>
                  <p className="text-gray-600 text-sm mb-4">
                    <strong>สถานที่:</strong> {activity.location}
                  </p>
                  <div className="flex items-center text-sm font-medium">
                    <UsersIcon />
                    <span className={isFull ? 'text-red-600' : isAlmostFull ? 'text-orange-500' : 'text-gray-700'}>
                      {count} / {activity.capacity} registered
                    </span>
                    {isFull && <span className="ml-2 text-xs font-bold text-white bg-red-600 px-2 py-1 rounded-full">FULL</span>}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 mt-auto">
                  <Link 
                    href={isFull ? '#' : `/student/register?activityId=${activity.id}`} 
                    className={`w-full text-center block px-4 py-2 font-semibold rounded-lg ${
                      isFull 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    aria-disabled={isFull}
                    onClick={(e) => isFull && e.preventDefault()}
                  >
                    {isFull ? 'เต็มแล้ว' : 'ลงทะเบียน'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}