# 聖經問答資料規格 (data spec)

Each file `bNN.json` (NN = 01..66) contains ONE Bible book object, UTF-8, valid JSON, no comments, no trailing commas.

```json
{
  "n": 1,
  "name": "創世記",
  "en": "Genesis",
  "testament": "OT",
  "q": [
    {
      "q": "神在第幾天創造了人？",
      "o": ["第三天", "第五天", "第六天", "第七天"],
      "a": 2,
      "ref": "創世記 1:26-31",
      "e": "神在第六天照自己的形像造人，並在第七天歇了工（創 2:2）。"
    }
  ]
}
```

## Field rules

| field | rule |
|---|---|
| `n` | book number 1..66 (canonical order) |
| `name` | 繁體中文書卷名，和合本通用名稱 |
| `en` | English book name |
| `testament` | `"OT"` (1-39) or `"NT"` (40-66) |
| `q[].q` | 繁體中文題目，一句問句，結尾用「？」 |
| `q[].o` | exactly 4 options, all 繁體中文, each 1–14 characters, no duplicates |
| `q[].a` | index (0-3) of the correct option |
| `q[].ref` | 和合本經文出處，格式如 `創世記 3:15` 或 `羅馬書 8:1-4` |
| `q[].e` | 1–2 sentence 繁體中文 explanation that states the biblical basis; may quote a short phrase |

## Content rules (important)

1. Every answer MUST be directly supported by the biblical text (和合本). No church tradition, no extra-biblical legend, no denominational interpretation, no disputed speculation.
2. Prefer concrete, checkable facts: names, numbers, places, who said/did what, order of events, list contents.
3. `ref` must be the verse(s) that actually contain the fact. If unsure of the exact verse, cite the chapter that clearly contains it (e.g. `撒母耳記上 17`) rather than inventing a precise verse number.
4. Distractors must be plausible but clearly wrong per the text (e.g. other real biblical names, nearby numbers). Never make two options defensible.
5. Vary the position of the correct answer across 0,1,2,3 — do not put most answers at the same index. `build_data.py` swaps the correct option into the least-used slot so A/B/C/D each occur equally often (counts differ by at most 1), globally and inside each book. Wording does not change.
6. Vary question phrasing: 誰／什麼／哪裡／為何／多少／哪一卷／排列順序 等. Avoid starting every question the same way.
7. Do not reuse the same question across books (e.g. a 四福音 event asked once only in its primary Gospel; other Gospels may ask about their own unique material).
8. Keep questions answerable by someone who has read the book — no trivia about modern editions or chapter divisions alone.
9. Traditional Chinese only (繁體字). Use 和合本 terms: 耶和華、彌賽亞、門徒、法利賽人、聖靈、約櫃、會幕、逾越節.

## Counts

The assigned question count per book is a hard minimum. Do not exceed 30 per book.
