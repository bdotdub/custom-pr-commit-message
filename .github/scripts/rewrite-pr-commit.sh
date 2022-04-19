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

