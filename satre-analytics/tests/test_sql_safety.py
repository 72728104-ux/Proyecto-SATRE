"""§5.6: toda consulta es un literal pasado a text(); nada de f-strings ni concatenación."""
import ast
from pathlib import Path

from sqlalchemy.sql.elements import TextClause

from app import db

DB_SOURCE = Path(db.__file__).read_text(encoding="utf-8")


def test_text_calls_only_receive_string_literals():
    tree = ast.parse(DB_SOURCE)
    calls = [n for n in ast.walk(tree)
             if isinstance(n, ast.Call) and getattr(n.func, "id", None) == "text"]
    assert calls
    for call in calls:
        assert len(call.args) == 1
        assert isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str)


def test_no_f_strings_in_db_module():
    assert not any(isinstance(n, ast.JoinedStr) for n in ast.walk(ast.parse(DB_SOURCE)))


def test_queries_use_bind_params():
    queries = [v for k, v in vars(db).items() if k.startswith("SQL_")]
    assert queries and all(isinstance(q, TextClause) for q in queries)
    assert all(q._bindparams for q in queries if q is not db.SQL_CURRENT_PERIOD)
