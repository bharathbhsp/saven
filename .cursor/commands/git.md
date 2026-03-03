git add, commit with clear short message and push. If there is a error, fix it and show what the error is and what the fix is. If the commit is successful, show the commit message. 

Check the code we are committing for sensitive data. If there is any, abort the commit and ask the user to remove the sensitive data.

```bash
git status
git add .
git commit -m "commit message" 
git push
```