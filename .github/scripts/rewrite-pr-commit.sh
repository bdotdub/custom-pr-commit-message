# First, set the git user
git config --global user.name $(git show -s --format='%an' HEAD)
git config --global user.email $(git show -s --format='%ae' HEAD)

# Pull
git commit --amend -F - <<EOF
$TITLE (#$NUMBER)

URL: $URL

---

$BODY
EOF

echo "Committed"
git show

echo "About to push"
git push -f origin HEAD:main

