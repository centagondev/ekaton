from django.db import migrations

from apps.events.anonymous_names import ANONYMOUS_NAMES


def seed_anonymous_names(apps, schema_editor):
    """
    Populate the anonymous name pool used by anonymous event chats.

    Migration 0002 only converted the names of participants that already
    existed, so a fresh database was left with an empty pool and every
    participant in an anonymous event ended up sharing a single fallback
    identity. Seeding here means a plain 'migrate' is enough.
    """
    AnonymousName = apps.get_model("events", "AnonymousName")

    AnonymousName.objects.bulk_create(
        [AnonymousName(display_name=name) for name in ANONYMOUS_NAMES],
        ignore_conflicts=True,
    )


def unseed_anonymous_names(apps, schema_editor):
    """
    Remove the seeded names, leaving any that were added separately.
    """
    AnonymousName = apps.get_model("events", "AnonymousName")

    AnonymousName.objects.filter(display_name__in=ANONYMOUS_NAMES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("events", "0003_eventmessage"),
    ]

    operations = [
        migrations.RunPython(
            seed_anonymous_names,
            unseed_anonymous_names,
        ),
    ]
