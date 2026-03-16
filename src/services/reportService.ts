import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  orderBy,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Report } from '@/types';

export const createReport = async (
  itemType: 'post' | 'comment' | 'user',
  itemId: string,
  reason: string,
  details?: {
    postContent?: string;
    commentText?: string;
    userId?: string;
    userName?: string;
  }
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Must be logged in to report');
  }

  const reportData = {
    reportedBy: currentUser.uid,
    reportedItem: {
      type: itemType,
      id: itemId,
    },
    reason,
    status: 'pending',
    createdAt: Timestamp.now(),
    details: details || {},
  };

  await addDoc(collection(db, 'reports'), reportData);
};

export const getAllReports = async (status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'): Promise<Report[]> => {
  try {
    let q = query(
      collection(db, 'reports'),
      orderBy('createdAt', 'desc')
    );

    if (status) {
      q = query(
        collection(db, 'reports'),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    const reports: Report[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      reports.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        reviewedAt: data.reviewedAt?.toDate(),
      } as Report);
    }

    return reports;
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error;
  }
};

export const updateReportStatus = async (
  reportId: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
  resolution?: string
): Promise<void> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Must be logged in to update reports');
  }

  const reportRef = doc(db, 'reports', reportId);
  
  await updateDoc(reportRef, {
    status,
    reviewedBy: currentUser.uid,
    reviewedAt: Timestamp.now(),
    ...(resolution && { resolution }),
  });
};

export const getReportById = async (reportId: string): Promise<Report | null> => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    const reportSnap = await getDoc(reportRef);

    if (!reportSnap.exists()) {
      return null;
    }

    const data = reportSnap.data();
    return {
      id: reportSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      reviewedAt: data.reviewedAt?.toDate(),
    } as Report;
  } catch (error) {
    console.error('Error fetching report:', error);
    throw error;
  }
};

export const getUserReports = async (userId: string): Promise<Report[]> => {
  try {
    const q = query(
      collection(db, 'reports'),
      where('reportedBy', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const reports: Report[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      reports.push({
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        reviewedAt: data.reviewedAt?.toDate(),
      } as Report);
    }

    return reports;
  } catch (error) {
    console.error('Error fetching user reports:', error);
    throw error;
  }
};
