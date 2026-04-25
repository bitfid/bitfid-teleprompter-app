import re
import unittest


def split_lines(text):
    return [line.strip() for line in re.split(r"\n+", text) if line.strip()]


def normalize_words(text):
    return [
        word
        for word in re.sub(r"[^a-z0-9\s']", " ", text.lower()).split()
        if len(word) > 1
    ]


def score_line(spoken, line):
    spoken_words = normalize_words(spoken)
    line_words = set(normalize_words(line))
    if not spoken_words or not line_words:
        return 0
    hits = sum(1 for word in spoken_words if word in line_words)
    return hits / max(len(line_words), len(spoken_words))


def best_line_for_speech(lines, active_line, spoken):
    start = max(0, active_line - 2)
    end = min(len(lines), active_line + 5)
    best_index = active_line
    best_score = 0
    for index in range(start, end):
        score = score_line(spoken, lines[index])
        if score > best_score:
            best_index = index
            best_score = score
    return best_index if best_score >= 0.18 else active_line


class PromptMatchingTests(unittest.TestCase):
    def test_split_lines_ignores_blank_lines(self):
        self.assertEqual(split_lines("One\n\n Two \n"), ["One", "Two"])

    def test_score_line_matches_case_and_punctuation(self):
        score = score_line("welcome bitfid teleprompter", "Welcome, Bitfid Teleprompter.")
        self.assertGreater(score, 0.9)

    def test_best_line_stays_near_current_reading_window(self):
        lines = [
            "The opening line is calm.",
            "The second line talks about the product.",
            "The third line mentions the microphone.",
            "The fourth line ends the test.",
        ]
        self.assertEqual(
            best_line_for_speech(lines, 1, "third line mentions microphone"),
            2,
        )

    def test_best_line_ignores_unrelated_speech(self):
        lines = ["Start here", "Continue here"]
        self.assertEqual(best_line_for_speech(lines, 0, "completely different words"), 0)


if __name__ == "__main__":
    unittest.main()
