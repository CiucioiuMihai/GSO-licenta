import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';

export interface LeaderboardEntry {
  id: string;
  rank: number;
  displayName: string;
  profilePicture?: string;
  xp: number;
  level: number;
}

export const getLeaderboard = async (limitCount = 50): Promise<LeaderboardEntry[]> => {
  const snapshot = await getDocs(
    query(collection(db, 'users'), orderBy('xp', 'desc'), limit(limitCount))
  );
  return snapshot.docs.map((doc, index) => ({
    id: doc.id,
    rank: index + 1,
    displayName: doc.data().displayName || 'Unknown',
    profilePicture: doc.data().profilePicture,
    xp: doc.data().xp || 0,
    level: doc.data().level || 1,
  }));
};
