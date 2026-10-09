// generate-hash.js
import bcrypt from 'bcrypt';

const password = 'Admin@Prime2024!';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log('Hash:', hash);
});
