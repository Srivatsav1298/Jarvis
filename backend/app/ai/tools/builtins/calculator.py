"""Calculator tool — safe arithmetic expression evaluation."""
import ast
import operator
import re

from app.ai.tools.registry import Tool

_ALLOWED_NODES = (ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant, ast.operator)
_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def _safe_eval(expr: str) -> float:
    tree = ast.parse(expr, mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, _ALLOWED_NODES):
            raise ValueError("Expression contains unsupported syntax")

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return node.value
            raise ValueError("Only numeric literals are allowed")
        if isinstance(node, ast.Name):
            raise ValueError("Variable references are not allowed")
        if isinstance(node, ast.BinOp):
            op = _OPS.get(type(node.op))
            if op is None:
                raise ValueError("Unsupported operator")
            return op(_eval(node.left), _eval(node.right))
        if isinstance(node, ast.UnaryOp):
            op = _OPS.get(type(node.op))
            if op is None:
                raise ValueError("Unsupported operator")
            return op(_eval(node.operand))
        raise ValueError("Unsupported expression")

    return float(_eval(tree.body))


async def calculator_tool(expression: str) -> dict:
    """Evaluate a safe arithmetic expression like '2 + 3 * 4'."""
    expr = re.sub(r"\s+", "", expression)
    if not expr or len(expr) > 200:
        return {"ok": False, "error": "Expression is empty or too long"}
    try:
        result = _safe_eval(expr)
        return {"ok": True, "expression": expression, "result": result}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}


calculator = Tool(
    name="calculator",
    description=(
        "Evaluate a safe arithmetic expression. Use for any computation, "
        "math, or number formatting question."
    ),
    input_schema={
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Arithmetic expression, e.g. '17 * 4 / 2'",
            }
        },
        "required": ["expression"],
    },
    output_schema={
        "type": "object",
        "properties": {
            "ok": {"type": "boolean"},
            "expression": {"type": "string"},
            "result": {"type": "number"},
            "error": {"type": "string"},
        },
    },
    handler=calculator_tool,
)