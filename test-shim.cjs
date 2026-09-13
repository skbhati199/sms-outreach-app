const fs = require("fs");
const content = fs.readFileSync("C:/Users/skbha/.gemini/antigravity-ide/brain/f915e069-4024-4500-ad55-5509040185b8/.system_generated/steps/914/output.txt", "utf8");

const oldTarget = 'var s=se(\\"react\\"),ce={},le=ce.env.VITE_GOOGLE_CLIENT_ID||\\"267028123948-8omvgmkdnm9k77ntoidj5pvf8ua3aouc.apps.googleusercontent.com\\";';
const newReplacement = 'var s=window.React,le=\\"267028123948-8omvgmkdnm9k77ntoidj5pvf8ua3aouc.apps.googleusercontent.com\\";';

console.log("Found target in output.txt?", content.includes(oldTarget));
