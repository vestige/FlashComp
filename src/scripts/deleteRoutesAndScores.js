// scripts/deleteRoutesAndScores.js
import { db } from "../firebase.js";
import {
  collectionGroup,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore";

const deleteSubCollection = async (name) => {
  const snapshot = await getDocs(collectionGroup(db, name));
  console.log(`🧹 ${name} の削除対象: ${snapshot.size} 件`);

  const deletions = snapshot.docs.map(async (docSnap) => {
    await deleteDoc(doc(db, docSnap.ref.path));
    console.log(`✅ 削除: ${docSnap.ref.path}`);
  });

  await Promise.all(deletions);
  console.log(`✅ ${name} の削除完了！`);
};

const run = async () => {
  await deleteSubCollection("routes");
  await deleteSubCollection("scores");
};

run().catch((err) => console.error("❌ エラー:", err));