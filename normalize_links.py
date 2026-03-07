import os
import glob

html_files = glob.glob('**/*.html', recursive=True)

count = 0
for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace href="index.html" with href="/"
    # and href="../index.html" with href="/"
    # also href="../../index.html" with href="/" just in case
    new_content = content.replace('href="index.html"', 'href="/"')
    new_content = new_content.replace('href="../index.html"', 'href="/"')
    new_content = new_content.replace('href="../../index.html"', 'href="/"')
    
    # Special case for anchor links like index.html#platforms
    new_content = new_content.replace('href="index.html#', 'href="/#')
    new_content = new_content.replace('href="../index.html#', 'href="/#')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        count += 1
        print(f"Updated {filepath}")

print(f"Total files updated: {count}")
