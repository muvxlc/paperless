# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e5]:
    - heading "Login" [level=1] [ref=e7]
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e13]: Username
        - textbox "Username" [ref=e16]
      - generic [ref=e17]:
        - generic [ref=e20]: Password
        - textbox "Password" [ref=e23]
      - button "Login" [active] [ref=e24] [cursor=pointer]
  - generic:
    - img
  - generic:
    - generic:
      - generic:
        - button "Go to parent" [disabled]
        - button "Open in editor"
        - button "Close"
  - generic [ref=e25]:
    - button "Toggle Nuxt DevTools" [ref=e26] [cursor=pointer]:
      - img [ref=e27]
    - generic "Page load time" [ref=e30]:
      - generic [ref=e31]: "30"
      - generic [ref=e32]: ms
    - button "Toggle Component Inspector" [ref=e34] [cursor=pointer]:
      - img [ref=e35]
```