const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting Echo360 Extension Build Process...\n');

const BUILD_DIR = path.join(__dirname, 'dist');

// 1. Clean the build directory
if (fs.existsSync(BUILD_DIR)) {
    console.log('🧹 Cleaning old build directory...');
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
}
fs.mkdirSync(BUILD_DIR);

// 2. Compile Tailwind CSS
console.log('🎨 Compiling final Tailwind CSS...');
try {
    execSync('npx @tailwindcss/cli -i input.css -o app/tailwind.css', { stdio: 'inherit' });
    console.log('✅ CSS compiled successfully.');
} catch (err) {
    console.error('❌ Failed to compile CSS. Make sure you ran npm install.');
    process.exit(1);
}

// 3. Define the critical files and folders that the extension actually needs
const essentialItems = [
    'manifest.json',
    'app/',
    'background/',
    'content/',
    'icons/',
    'lib/',
    'offscreen/',
    'popup/',
    'stream/'
];

// Helper function to recursively copy directories
function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    
    if (isDirectory) {
        fs.mkdirSync(dest);
        fs.readdirSync(src).forEach(function(childItemName) {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

console.log('\n📦 Packaging essential files...');
essentialItems.forEach(item => {
    const srcPath = path.join(__dirname, item);
    const destPath = path.join(BUILD_DIR, item);
    
    if (fs.existsSync(srcPath)) {
        copyRecursiveSync(srcPath, destPath);
        console.log(`   Copied: ${item}`);
    } else {
        console.warn(`   ⚠️ Warning: Could not find ${item}`);
    }
});

console.log('\n🎉 Build Complete!');
console.log(`Your production-ready extension is located in: ${BUILD_DIR}`);
console.log('You can now ZIP this folder and upload it to the Chrome Web Store.');