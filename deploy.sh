#!/bin/bash

# Build the project
echo "Building project..."
npm run build

# Copy built files to root (for GitHub Pages)
echo "Copying built files to root..."
cp -r dist/* .

# Add and commit changes
echo "Committing changes..."
git add .
git commit -m "Deploy: $(date)"
git push

echo "Deployment complete!"
