const ADMIN_USER = "admin";
const OLD_PASS = "SuperStrongP@ssw0rd!123@@";
const NEW_PASS = "SuperStrongN3wP@ss!456##";
const apiUrl = 'http://localhost:4000/api/v1';

async function performLogin(username, password) {
  const res = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return { status: res.status, ok: res.ok, data: await res.json() };
}

async function run() {
  console.log("1. Login with old password");
  let loginRes = await performLogin(ADMIN_USER, OLD_PASS);
  if (!loginRes.ok) {
      // Maybe already changed, let's login with NEW_PASS
      loginRes = await performLogin(ADMIN_USER, NEW_PASS);
      if(!loginRes.ok) return console.error("Initial login failed with both old/new passes.", loginRes);
      console.log("Logged in with NEW_PASS (already changed previously). Reseting back to OLD_PASS...");
      // Reset logic to easily re-run test
      const resReset = await fetch(`${apiUrl}/auth/change-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginRes.data.token}` },
          body: JSON.stringify({ currentPassword: NEW_PASS, newPassword: OLD_PASS })
      });
      if (!resReset.ok) return console.error("Failed to reset password.");
      loginRes = await performLogin(ADMIN_USER, OLD_PASS);
  }
  
  const token = loginRes.data.token;
  if (!token) return console.error("Token not found in login data");

  console.log("2. Change password to new password");
  const resChange = await fetch(`${apiUrl}/auth/change-password`, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ 
        currentPassword: OLD_PASS, 
        newPassword: NEW_PASS 
    })
  });
  
  if (!resChange.ok) {
     console.error("Change-password failed:", await resChange.text());
     return;
  }
  
  console.log("3. Test login with old password (should fail)");
  const loginOld = await performLogin(ADMIN_USER, OLD_PASS);
  if (loginOld.ok) console.error("❌ Login with old password succeeded unexpectedly!");
  else console.log("✅ Login with old password correctly failed with:", loginOld.status);

  console.log("4. Test login with new password (should succeed)");
  const loginNew = await performLogin(ADMIN_USER, NEW_PASS);
  if (!loginNew.ok) console.error("❌ Login with new password failed with:", loginNew.status, loginNew.data);
  else console.log("✅ Login with new password succeeded!");
  
  console.log("5. Test invalid current password logic");
  const resFail = await fetch(`${apiUrl}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginNew.data.token}` },
    body: JSON.stringify({ currentPassword: "wrong_password", newPassword: "SomeOtherPassword!123" })
  });
  if (resFail.status === 401) console.log("✅ Invalid current password correctly failed with 401");
  else console.error("❌ Invalid current password returned:", resFail.status);
}

run().catch(console.error);
