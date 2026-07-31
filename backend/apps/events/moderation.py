"""
Masks bad words out of event chat messages.

The word list lives in the BadWord table and is managed from the Django
admin. Kept beside services.py rather than inside it, the same way
anonymous_names.py and chat/matchmaking.py are.
"""

import re

from django.core.cache import cache

from .models import BadWord

# The list changes rarely but is read on every message, so it is cached
# instead of queried each time. A newly added word goes live within this
# window; loading it fresh costs about half a second against the database.

CACHE_KEY="event_bad_words"
CACHE_TIMEOUT= 300

# Characters people swap in to slip a word past a filter.
CHARACTER_SUBSTITUTIONS = {
    "@": "a",
    "0": "o",
    "1": "i",
    "3": "e",
    "5": "s",
    "$": "s",
    "!": "i",
}

# Only substituted between two letters: "sh!t" is someone hiding a word, but
# a "!" at the end of a sentence is ordinary punctuation and must not turn
# into an "i" — that alone stopped "thayoli!" from being matched.
SUBSTITUTION_PATTERN = re.compile(r"(?<=\w)([@0135$!])(?=\w)")

''' Three or more of the same letter is someone stretching a word out; two is
# usually a real one.'''
REPEATED_LETTERS = re.compile(r"(.)\1{2,}")
# A run of single letters — "f u c k" typed to break the word apart.
SPACED_LETTERS = re.compile(r"\b(?:\w\s+)+\w\b")

# A word this long is also matched inside a longer one, so "mockerfucker" is
# caught by "fucker". Shorter entries stay whole-word only, because they turn
# up inside ordinary words: "ass" sits in "class", "anal" in "analysis",
# "cock" in "cocktail", "cum" in "document", "pur" in "purpose".
SUBSTRING_MIN_LENGTH = 6


def normalise(text):
    """
    Return the comparable form of a message word or a stored bad word.

    Both sides go through this, so a typed "F.U.C.K" and the stored "fuck"
    meet in the middle.
    """
    text = SUBSTITUTION_PATTERN.sub(
        lambda match: CHARACTER_SUBSTITUTIONS[match.group(1)], text.lower()
    )


    # Punctuation sitting between two letters is someone breaking a word up,
    # so it is removed and the halves close over it: "th.a.y.o.l.i" becomes
    # "thayoli" and the stored "aan-vedi" becomes one word rather than two.
    text = re.sub(r"(?<=\w)[^\w\s]+(?=\w)", "", text)

    # Anywhere else it is ordinary punctuation and becomes a space, which is
    # what keeps a trailing "!" from gluing itself onto the word before it.
    text = re.sub(r"[^\w\s]", " ", text)
    
    text = SPACED_LETTERS.sub(lambda match: match.group().replace(" ", ""), text)
    text = REPEATED_LETTERS.sub(r"\1", text)
    return re.sub(r"\s+", " ", text).strip()

def get_bad_words():
    """
    Return the active bad words as (single words, phrases by word count).

    Already normalised, so a message only has to be normalised once. Your
    list is roughly half phrases, which is why they are kept separately —
    a phrase has to be matched against a window of that many words.
    """
    def load():
        singles = set()
        phrases = {}
        embedded = []

        for word in BadWord.objects.filter(is_active=True).values_list(
            "word", flat=True
        ):
            normalised = normalise(word)
            if not normalised:
                continue

            parts = normalised.split()

            if len(parts) == 1:
                singles.add(normalised)

                if len(normalised) >= SUBSTRING_MIN_LENGTH:
                    embedded.append(normalised)
            else:
                phrases.setdefault(len(parts), set()).add(normalised)

        # One alternation rather than a loop over 200-odd words, so checking a
        # token stays a single pass however long the list grows.
        pattern = (
            re.compile("|".join(re.escape(word) for word in embedded))
            if embedded
            else None
        )

        return singles, phrases, pattern

    return cache.get_or_set(CACHE_KEY, load, CACHE_TIMEOUT)


def moderate(content):
    """
    Return the message with every bad word replaced by asterisks.

    Never rejects anything: a message that is entirely bad words simply comes
    back entirely masked.
    """
    singles, phrases, embedded = get_bad_words()

    if not singles and not phrases:
        return content

    # "f u c k" spans several words, so it is handled before the message is
    # split. Only replaced when the joined form is genuinely a bad word, so
    # an innocent run of initials is left exactly as typed.
    def mask_spaced(match):
        joined = normalise(match.group().replace(" ", ""))
        return "*" * len(joined) if joined in singles else match.group()

    content = SPACED_LETTERS.sub(mask_spaced, content)

    tokens = list(re.finditer(r"\S+", content))
    normalised = [normalise(token.group()) for token in tokens]
    masked = [False] * len(tokens)
    # Set only for a bad word buried inside a longer one, holding the slice of
    # that word to star out. None means star the whole word.
    inner = [None] * len(tokens)

    # Longest phrases first, so "thayoli idli" is masked as the phrase it is
    # rather than leaving "idli" behind.
    for size in sorted(phrases, reverse=True):
        for start in range(len(tokens) - size + 1):
            if any(masked[start : start + size]):
                continue

            if " ".join(normalised[start : start + size]) in phrases[size]:
                for index in range(start, start + size):
                    masked[index] = True

    for index, word in enumerate(normalised):
        if not masked[index] and word in singles:
            masked[index] = True

    # Anything left is checked for a long bad word buried inside it, which is
    # what catches "mockerfucker" -> "mocker******".
    if embedded is not None:
        for index, word in enumerate(normalised):
            if masked[index]:
                continue

            found = embedded.search(word)

            if found is None:
                continue

            masked[index] = True

            # Only the offending part is starred, leaving the rest readable.
            # The offsets line up only while normalising left the length
            # alone; collapsing repeats or dropping punctuation shifts every
            # position after it, and there the whole word is starred instead.
            if len(word) == len(tokens[index].group()):
                inner[index] = (found.start(), found.end())

    # Rebuilt back to front so the earlier spans stay valid as it goes, which
    # also keeps the original spacing and any line breaks intact.
    for index in reversed(range(len(tokens))):
        if not masked[index]:
            continue

        token = tokens[index]

        if inner[index] is None:
            start, end = token.start(), token.end()
            stars = len(normalised[index])
        else:
            offset_start, offset_end = inner[index]
            start = token.start() + offset_start
            end = token.start() + offset_end
            stars = offset_end - offset_start

        content = content[:start] + "*" * stars + content[end:]

    return content


def contains_bad_word(text):
    """
    Whether the text holds a bad word.

    Used where profanity is rejected instead of masked, such as an event name.
    moderate() leaves clean text exactly as it was, so a difference means it
    found something — which keeps both uses reading the same word list with
    the same rules.
    """
    return moderate(text) != text
