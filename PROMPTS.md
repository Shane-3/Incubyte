# PROMPTS

Raw, unedited AI chat logs (or public share links) used while building this project, appended in order.
Never paste secrets, `.env` contents or tokens here.

## Session 1: Claude Code (Claude Opus 5.5) in VS Code, 2026-10-24 to 2026-10-25

Every prompt typed in the session, verbatim and in order, taken from the Claude Code session transcript. Where a prompt came with a screenshot, that is noted. Answers to the multiple-choice questions Claude asked are included as recorded. The session ran out of context once (2026-10-25 09:32 UTC) and continued from an automatic summary; no prompts were lost.

### 1. 2026-10-24 14:50 UTC

```text
Read and understand then tell yes
```

### 2. 2026-10-24 14:51 UTC

```text
start
```

**Answers to Claude's questions (2026-10-24 15:37 UTC):**

- Integration tests need a real PostgreSQL. Docker isn't running, but you have PostgreSQL 17 running natively on port 5432. Which should the project use? → Local Postgres 17 (Recommended)

### 3. 2026-10-24 16:57 UTC

```text
its done
```

### 4. 2026-10-24 17:40 UTC

```text
continue
```

### 5. 2026-10-24 18:13 UTC

```text
continue
```

### 6. 2026-10-24 19:04 UTC (with a screenshot)

```text
why purchase in admin panel + notify me on admin for stocks?
```

### 7. 2026-10-24 19:13 UTC

```text
1. keep it as it is and in soldout row for admins use restock instead of notify me.
2. purchase stays for everyone still disabled at 0 stocks.
3. api stays as spec says.
4. Can we add car mode images and also color varient for model and available color but has same sku for different color so when you add it adds to the model with that color varient and you can view cars on colors as well
```

**Answers to Claude's questions (2026-10-24 19:17 UTC):**

- How should stock work with colours? → Stock per colour (Recommended)
- Where should the car images come from? → Built-in tinted illustrations (Recommended)
- What should happen when someone adds a vehicle whose make and model already exist? → Merge into the model (Recommended)
- Should each model get a visible SKU code? → Auto-generated (Recommended)

### 8. 2026-10-24 19:49 UTC (with a screenshot)

```text
why does user have edit option
```

### 9. 2026-10-24 19:55 UTC

```text
No its all good and perfect. One last thing. The dashboard should be professional with great user experience and visually appealing. So do some research and work on that as well.
```

### 10. 2026-10-24 20:21 UTC (with a screenshot)

```text
see the unalignment of paint and also why cant i add vehicle and multiple colors at same time?
```

### 11. 2026-10-24 21:09 UTC

```text
when restock it should have with colors and units as well instead of just 1 color restock at a time
```

### 12. 2026-10-25 09:27 UTC

```text
Add a page or smth where they can track the latest purchases happened and it is only for admin
```

### 13. 2026-10-25 10:38 UTC

```text
In the login page below the form give admin password and email but for user ask to create one
```

