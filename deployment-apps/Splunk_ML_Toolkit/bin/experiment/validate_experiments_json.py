import json
import os

from vendor.jsonschema import Draft4Validator, SchemaError, ValidationError
from vendor.jsonschema import validate

EXPERIMENT_SCHEMA_FILE = os.path.join(os.path.dirname(__file__), "experiment_schema.json")


def validate_experiments_json(json_data, schema_file=EXPERIMENT_SCHEMA_FILE):
    # Should the name of the schema file be in some configuration file?
    with open(schema_file) as f:
        schema = json.load(f)

    try:
        Draft4Validator.check_schema(schema)
        validate(json_data, schema)
    except SchemaError as e:
        raise Exception("Failed to check JSON schema in {}: {}".format(EXPERIMENT_SCHEMA_FILE, e.message))
    except ValidationError as e:
        raise Exception("Unable to validate data against json schema in {}: {}".format(EXPERIMENT_SCHEMA_FILE,
                                                                                       e.message))
