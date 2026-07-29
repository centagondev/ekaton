import secrets

from django.core.management.base import BaseCommand

from apps.events.models import AnonymousName
from apps.public_speaking.models import PublicSpeaking


class Command(BaseCommand):
    help = "Create (or replace) the single live public speaking discussion."

    def add_arguments(self, parser):
        parser.add_argument("--title", default="Public Speaking")
        parser.add_argument(
            "--topic",
            default="What’s the most messed-up thing a friend did that you can laugh about today?",
        )

    def handle(self, *args, **options):
        pool = AnonymousName.objects.count()

        if pool == 0:
            self.stderr.write(
                self.style.ERROR(
                    "No anonymous names are seeded — run 'manage.py migrate' first."
                )
            )
            return

        # Only one discussion is ever live; retiring the others keeps
        # get_active_discussion() unambiguous.
        PublicSpeaking.objects.filter(is_active=True).update(is_active=False)

        discussion = PublicSpeaking.objects.create(
            title=options["title"],
            topic=options["topic"],
            is_active=True,
            # A random offset so the first identity handed out is not the same
            # name at every talk.
            anonymous_seed=secrets.randbelow(pool),
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Live discussion: {discussion.title!r} "
                f"({pool} anonymous names available)"
            )
        )
        self.stdout.write(f"Topic: {discussion.topic}")
