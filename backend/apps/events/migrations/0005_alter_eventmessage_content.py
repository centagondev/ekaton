from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("events", "0004_seed_anonymous_names"),
    ]

    operations = [
        migrations.AlterField(
            model_name="eventmessage",
            name="content",
            field=models.TextField(
                help_text="Text content of the message.",
                max_length=1000,
            ),
        ),
    ]
