# First, set the git user
git config --global user.name $(git show -s --format='%an' HEAD)
git config --global user.email $(git show -s --format='%ae' HEAD)

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

