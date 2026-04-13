/**
 * Generate a random secure password
 * @param {number} length - Length of the password (default: 6)
 * @returns {string} - Random password
 */
export const generateRandomPassword = (length = 6) => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "@#$";
  const allChars = uppercase + lowercase + numbers + special;

  let password = "";

  // Ensure at least one uppercase, one lowercase, one number
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];

  // Fill the rest randomly (for 6 chars total, 3 more needed)
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};
