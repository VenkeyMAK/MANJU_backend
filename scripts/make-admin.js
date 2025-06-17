import dbPromise from '../db.js';

const userEmailToMakeAdmin = 'venkatesh@example.com'; // Change this if you want to make a different user admin

const makeAdmin = async () => {
  let client;
  try {
    console.log('Connecting to the database...');
    const db = await dbPromise();
    const users = db.collection('users');

    console.log(`Searching for user with email: ${userEmailToMakeAdmin}`);
    const result = await users.updateOne(
      { email: userEmailToMakeAdmin },
      { $set: { role: 'admin' } }
    );

    if (result.matchedCount === 0) {
      console.log(`Error: No user found with email: ${userEmailToMakeAdmin}`);
    } else if (result.modifiedCount === 0) {
      console.log(`User ${userEmailToMakeAdmin} is already an admin.`);
    } else {
      console.log(`Successfully updated ${userEmailToMakeAdmin} to be an admin.`);
    }
  } catch (err) {
    console.error('An error occurred:', err);
  } finally {
    // The db.js module manages a singleton connection, so we don't close it here.
    // In a standalone script, you would typically close the client connection.
    console.log('Script finished.');
    process.exit(0);
  }
};

makeAdmin();
