'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useParams } from 'next/navigation';

export default function QueueDisplayPage() {
  const params = useParams();
  const { id: activityId } = params;
  const [activity, setActivity] = useState(null);
  const [channels, setChannels] = useState([]);
  const [fullQueue, setFullQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    if (activityId) {
      const activityRef = doc(db, 'activities', activityId);
      const activitySnap = await getDoc(activityRef);
      if (activitySnap.exists()) {
        setActivity({ id: activitySnap.id, ...activitySnap.data() });
      }
    }
  }, [activityId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    if (activityId) {
      const channelsRef = collection(db, 'queueChannels');
      const qChannels = query(channelsRef, where('activityId', '==', activityId));
      const unsubscribeChannels = onSnapshot(qChannels, (querySnapshot) => {
        const channelsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setChannels(channelsData);
        setIsLoading(false);
      });

      const queueRef = collection(db, 'queues');
      const qQueue = query(queueRef, where('activityId', '==', activityId));
      const unsubscribeQueue = onSnapshot(qQueue, (querySnapshot) => {
        const queueData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFullQueue(queueData);
      });
      
      return () => {
          unsubscribeChannels();
          unsubscribeQueue();
      }
    }
  }, [activityId]);

  const getStudentName = (queueNumber) => {
    if (!queueNumber) return '-';
    const queueItem = fullQueue.find(item => item.queueNumber === queueNumber);
    return queueItem ? queueItem.studentName : '-';
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-center mb-2">สถานะคิว</h1>
      <h2 className="text-2xl text-center text-gray-600 mb-8">{activity?.name}</h2>
      {isLoading ? <p className="text-center">กำลังโหลด...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {channels.map(channel => (
            <div key={channel.id} className="bg-white p-6 rounded-lg shadow-lg text-center">
              <h3 className="text-xl font-semibold mb-2">ช่องบริการที่ {channel.channelNumber}</h3>
              <p className="text-6xl font-bold text-blue-600">{channel.currentQueueNumber || '-'}</p>
              <p className="text-gray-500 mt-2 text-2xl h-8">{getStudentName(channel.currentQueueNumber)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}