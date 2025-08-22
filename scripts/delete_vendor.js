// scripts/delete_vendor.js

require('dotenv').config();
const { initializeFirebase, getDatabase } = require('../src/config/database');

async function deleteCollection(db, collectionRef, batchSize = 300) {
	const snapshot = await collectionRef.limit(batchSize).get();
	if (snapshot.empty) return 0;
	const batch = db.batch();
	snapshot.docs.forEach(doc => batch.delete(doc.ref));
	await batch.commit();
	return snapshot.size;
}

async function deleteDocumentWithSubcollections(db, docRef) {
	// List subcollections and delete their docs
	const subcollections = await docRef.listCollections();
	for (const sub of subcollections) {
		// Delete nested collections one level deep (products/customers/profile/orders, etc.)
		let deleted = 0;
		// Keep deleting until empty (handles > batchSize)
		while (true) {
			const count = await deleteCollection(db, sub);
			deleted += count;
			if (count === 0) break;
		}
		console.log(`Deleted ${deleted} docs from subcollection ${docRef.path}/${sub.id}`);
	}
	// Delete the document itself
	await docRef.delete();
	console.log(`Deleted document ${docRef.path}`);
}

async function main() {
	const phone = (process.argv[2] || '').replace(/\D/g, '');
	if (!phone) {
		console.error('Usage: node scripts/delete_vendor.js <phoneNumber>');
		process.exit(1);
	}

	initializeFirebase();
	const db = getDatabase();

	const vendorDocRef = db.collection('vendors').doc(phone);
	const vendorDoc = await vendorDocRef.get();
	if (vendorDoc.exists) {
		console.log(`Found vendor ${phone}. Deleting subcollections and document...`);
		await deleteDocumentWithSubcollections(db, vendorDocRef);
	} else {
		console.log(`Vendor ${phone} does not exist (skipping vendor delete)`);
	}

	// Delete whatsapp_business_mapping entry (doc id is the phone number in our code)
	const mappingDocRef = db.collection('whatsapp_business_mapping').doc(phone);
	const mappingDoc = await mappingDocRef.get();
	if (mappingDoc.exists) {
		await mappingDocRef.delete();
		console.log(`Deleted mapping whatsapp_business_mapping/${phone}`);
	} else {
		console.log(`Mapping whatsapp_business_mapping/${phone} does not exist (skipping)`);
	}

	console.log('Cleanup complete.');
}

main().catch(err => {
	console.error('Error during deletion:', err);
	process.exit(1);
});