#!/usr/bin/env python3
"""Merge data/b*.json + data/p*.json into a single data.js and validate it."""
import glob
import json
import math
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "data"

EXPECTED = [
    "創世記", "出埃及記", "利未記", "民數記", "申命記", "約書亞記", "士師記", "路得記",
    "撒母耳記上", "撒母耳記下", "列王紀上", "列王紀下", "歷代志上", "歷代志下", "以斯拉記",
    "尼希米記", "以斯帖記", "約伯記", "詩篇", "箴言", "傳道書", "雅歌", "以賽亞書",
    "耶利米書", "耶利米哀歌", "以西結書", "但以理書", "何西阿書", "約珥書", "阿摩司書",
    "俄巴底亞書", "約拿書", "彌迦書", "那鴻書", "哈巴谷書", "西番雅書", "哈該書",
    "撒迦利亞書", "瑪拉基書", "馬太福音", "馬可福音", "路加福音", "約翰福音", "使徒行傳",
    "羅馬書", "哥林多前書", "哥林多後書", "加拉太書", "以弗所書", "腓立比書", "歌羅西書",
    "帖撒羅尼迦前書", "帖撒羅尼迦後書", "提摩太前書", "提摩太後書", "提多書", "腓利門書",
    "希伯來書", "雅各書", "彼得前書", "彼得後書", "約翰一書", "約翰二書", "約翰三書",
    "猶大書", "啟示錄",
]


def norm_q(raw):
    if isinstance(raw, dict):
        return {
            "q": str(raw["q"]).strip(),
            "o": [str(x).strip() for x in raw["o"]],
            "a": int(raw["a"]),
            "ref": str(raw.get("ref", "")).strip(),
            "e": str(raw.get("e", "")).strip(),
        }
    q, o, a, ref, e = raw
    return {"q": q.strip(), "o": [x.strip() for x in o], "a": int(a), "ref": ref.strip(), "e": e.strip()}


def load():
    books = {}
    for path in sorted(glob.glob(str(DATA / "b*.json"))):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        d["q"] = [norm_q(x) for x in d["q"]]
        books[d["n"]] = d
    for path in sorted(glob.glob(str(DATA / "p*.json"))):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        for b in d["books"]:
            b["q"] = [norm_q(x) for x in b["q"]]
            if b["n"] in books:
                print(f"  ! duplicate book {b['n']} in {path}, keeping first")
                continue
            books[b["n"]] = b
    return [books[k] for k in sorted(books)]



def balance_answers(books, seed=20261101):
    """Re-order each question's options so the correct answer is spread evenly
    over A/B/C/D — per book and overall. Deterministic for a fixed seed."""
    rng = random.Random(seed)
    total = [0, 0, 0, 0]

    for b in books:
        n = len(b["q"])
        quota = math.ceil(n / 4)
        per_book = [0, 0, 0, 0]
        prev = -1

        for q in b["q"]:
            opts = q["o"]
            correct = opts[q["a"]]

            cand = [i for i in range(4) if per_book[i] < quota and i != prev]
            if not cand:
                cand = [i for i in range(4) if per_book[i] < quota] or [0, 1, 2, 3]
            low = min(total[i] for i in cand)
            cand = [i for i in cand if total[i] == low]
            target = rng.choice(sorted(cand))

            rest = [o for j, o in enumerate(opts) if j != q["a"]]
            if rng.random() < 0.5:
                rest.reverse()

            new = []
            k = 0
            for i in range(4):
                if i == target:
                    new.append(correct)
                else:
                    new.append(rest[k])
                    k += 1
            assert set(new) == set(opts), "option set changed while balancing"

            q["o"] = new
            q["a"] = target
            per_book[target] += 1
            total[target] += 1
            prev = target

    return total


def validate(books):
    errors, warnings = [], []
    seen_n = {b["n"] for b in books}
    missing = [i + 1 for i in range(66) if (i + 1) not in seen_n]
    if missing:
        errors.append(f"missing books: {missing}")

    total = 0
    for b in books:
        if b["name"] != EXPECTED[b["n"] - 1]:
            errors.append(f"book {b['n']} name '{b['name']}' != '{EXPECTED[b['n'] - 1]}'")
        want_t = "OT" if b["n"] <= 39 else "NT"
        if b.get("testament") != want_t:
            errors.append(f"book {b['n']} testament {b.get('testament')} != {want_t}")
        if not (10 <= len(b["q"]) <= 30):
            errors.append(f"book {b['n']} {b['name']} has {len(b['q'])} questions (need 10-30)")

        texts = set()
        for i, q in enumerate(b["q"]):
            total += 1
            tag = f"{b['name']} Q{i + 1}"
            if len(q["o"]) != 4:
                errors.append(f"{tag}: {len(q['o'])} options")
            if not 0 <= q["a"] < len(q["o"]):
                errors.append(f"{tag}: answer index {q['a']} out of range")
            if len(set(q["o"])) != len(q["o"]):
                errors.append(f"{tag}: duplicate options")
            if not q["q"].endswith(("？", "?", "。")) and len(q["q"]) < 4:
                errors.append(f"{tag}: question text too short")
            if not q["ref"]:
                warnings.append(f"{tag}: no verse reference")
            if q["q"] in texts:
                errors.append(f"{tag}: duplicate question text")
            texts.add(q["q"])

    # cross-book duplicate questions
    allq = {}
    for b in books:
        for q in b["q"]:
            allq.setdefault(q["q"], []).append(b["name"])
    for text, where in allq.items():
        if len(where) > 1:
            warnings.append(f"duplicate across books: {'/'.join(where)} — {text[:28]}")

    return errors, warnings, total


def main():
    books = load()
    dist = balance_answers(books)
    errors, warnings, total = validate(books)

    for w in warnings[:20]:
        print(f"WARN {w}")
    if len(warnings) > 20:
        print(f"WARN ... {len(warnings) - 20} more")

    if errors:
        print("\nERRORS:")
        for e in errors:
            print("  " + e)
        print(f"\n{len(errors)} error(s) — data.js NOT written")
        return 1

    payload = json.dumps(books, ensure_ascii=False, separators=(",", ":"))
    out = ROOT / "data.js"
    out.write_text(
        "/* 聖經問答練習 — question bank. Generated by build_data.py; do not edit by hand. */\n"
        "window.BIBLE_QUIZ_DATA = " + payload + ";\n",
        encoding="utf-8",
    )
    print(f"OK  {len(books)} books, {total} questions -> data.js ({out.stat().st_size / 1024:.0f} KB)")
    print(f"答案分佈 A/B/C/D = {'/'.join(map(str, dist))}")
    for b in books:
        print(f"  {b['n']:>2} {b['name']:<8} {len(b['q']):>2}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
