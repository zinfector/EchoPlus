import os
import shutil
import subprocess
import json
import sys

print("Starting Echo360 Extension Build Process...\n")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.join(BASE_DIR, "dist")
NODE_MODULES_DIR = os.path.join(BASE_DIR, "node_modules")
PACKAGE_JSON = os.path.join(BASE_DIR, "package.json")

# 0. Sanity Check: Dependencies
def check_dependencies():
    print("Checking dependencies...")
    missing_deps = []
    
    if not os.path.exists(NODE_MODULES_DIR):
        print("node_modules folder not found.")
        missing_deps = ["all dependencies (node_modules is missing)"]
    elif os.path.exists(PACKAGE_JSON):
        try:
            with open(PACKAGE_JSON, 'r', encoding='utf-8') as f:
                pkg = json.load(f)
                deps = pkg.get("dependencies", {})
                for dep in deps:
                    if not os.path.exists(os.path.join(NODE_MODULES_DIR, dep.replace('/', os.sep))):
                        # Some nested scoped packages might be structured differently, but this is a good basic check
                        # A more robust check is just testing if tailwindcss CLI is available
                        pass
        except Exception as e:
            pass
            
    # The most reliable check is seeing if the tailwind CLI actually exists
    try:
        subprocess.run(["npx", "--no-install", "@tailwindcss/cli", "--help"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True, shell=True)
    except subprocess.CalledProcessError:
        missing_deps.append("@tailwindcss/cli or related build tools")

    if missing_deps:
        print("\nMissing the following build dependencies:")
        for dep in missing_deps:
            print(f" - {dep}")
            
        choice = input("\nWould you like to run 'npm install' to install them now? (y/N): ").strip().lower()
        if choice == 'y' or choice == 'yes':
            print("\nRunning npm install...")
            try:
                subprocess.run(["npm", "install"], check=True, shell=True)
                print("Dependencies installed successfully.\n")
            except subprocess.CalledProcessError:
                print("Failed to install dependencies. Please run 'npm install' manually.")
                sys.exit(1)
        else:
            print("Cannot build without dependencies. Exiting.")
            sys.exit(1)
    else:
        print("All dependencies are satisfied.\n")

check_dependencies()

# 1. Clean the build directory
if os.path.exists(BUILD_DIR):
    print("Cleaning old build directory...")
    shutil.rmtree(BUILD_DIR)
os.makedirs(BUILD_DIR)

# 2. Compile Tailwind CSS
print("Compiling final Tailwind CSS...")
try:
    # Use shell=True for npx to work properly on Windows
    subprocess.run(["npx", "@tailwindcss/cli", "-i", "input.css", "-o", "app/tailwind.css"], check=True, shell=True)
    print("CSS compiled successfully.")
except subprocess.CalledProcessError:
    print("Failed to compile CSS. Make sure you ran npm install.")
    exit(1)

# 3. Define the critical files and folders that the extension actually needs
essential_items = [
    "manifest.json",
    "app",
    "background",
    "content",
    "icons",
    "lib",
    "offscreen",
    "popup",
    "stream"
]

print("\nPackaging essential files...")
for item in essential_items:
    src_path = os.path.join(BASE_DIR, item)
    dest_path = os.path.join(BUILD_DIR, item)
    
    if os.path.exists(src_path):
        if os.path.isdir(src_path):
            shutil.copytree(src_path, dest_path)
        else:
            shutil.copy2(src_path, dest_path)
        print(f"   Copied: {item}")
    else:
        print(f"   Warning: Could not find {item}")

print("\nBuild Complete!")
print(f"Your production-ready extension is located in: {BUILD_DIR}")
print("You can now ZIP this folder and upload it to the Chrome Web Store.")
