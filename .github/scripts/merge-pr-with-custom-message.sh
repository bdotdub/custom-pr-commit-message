# Produce the squshed PR. By default, these changes are already staged.
git merge --squash $SHA

# Add the custom message to the commit message.
git commit -F - <<EOF
$TITLE (#$NUMBER)
URL: $URL

$BODY
EOF

# Push to main
git push -f origin HEAD:main

