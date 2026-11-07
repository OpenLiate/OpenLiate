import unittest
import sys
import os

# Add src to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))

from openliate import liate, AgentRunResult

class TestOpenLiatePythonSDK(unittest.TestCase):
    def test_class_is_an_agent_5_properties(self):
        class GreetingAgent(liate):
            L = "sarvam/sarvam-105b"
            I = {"memory": "sessions/test-python"}
            A = {"name": "greeting_agent", "intent": "Friendly assistant"}
            T = {
                "fetch": {
                    "command": "uvx",
                    "args": ["mcp-server-fetch"],
                    "tools": ["*"]
                }
            }
            E = {"SARVAM_API_KEY": "test_key_python"}

        agent = GreetingAgent()
        module = agent.to_module()

        self.assertEqual(module["L"], "sarvam/sarvam-105b")
        self.assertEqual(module["I"], {"memory": "sessions/test-python"})
        self.assertEqual(module["A"]["name"], "greeting_agent")
        self.assertEqual(module["A"]["intent"], "Friendly assistant")
        self.assertEqual(module["T"]["fetch"]["command"], "uvx")
        self.assertEqual(module["E"]["SARVAM_API_KEY"], "test_key_python")

    def test_strict_layer_l_enforcement(self):
        class IncompleteAgent(liate):
            I = {"memory": "sessions/no-model"}
            A = {"name": "no_model"}
            T = []
            E = {}

        agent = IncompleteAgent()
        with self.assertRaises(ValueError) as ctx:
            agent.to_module()
        self.assertIn("Missing required Layer [L]", str(ctx.exception))

    def test_full_name_liate_properties(self):
        class FullNameAgent(liate):
            LLM = "sarvam/sarvam-105b"
            Integration = {"memory": "sessions/python-full"}
            Agent = {"name": "full_python_agent"}
            Tools = {
                "fetch": {
                    "command": "uvx",
                    "args": ["mcp-server-fetch"],
                    "tools": ["*"]
                }
            }
            Environment = {"SARVAM_API_KEY": "py_key"}

        agent = FullNameAgent()
        module = agent.to_module()
        self.assertEqual(module["L"], "sarvam/sarvam-105b")
        self.assertEqual(module["I"]["memory"], "sessions/python-full")
        self.assertEqual(module["A"]["name"], "full_python_agent")
        self.assertEqual(module["T"]["fetch"]["command"], "uvx")
        self.assertEqual(module["E"]["SARVAM_API_KEY"], "py_key")

    def test_lowercase_liate_properties(self):
        class LowercaseAgent(liate):
            llm = "sarvam/sarvam-105b"
            integration = {"memory": "sessions/python-lower"}
            agent = {"name": "lower_python_agent"}
            tools = {
                "fetch": {
                    "command": "uvx",
                    "args": ["mcp-server-fetch"],
                    "tools": ["*"]
                }
            }
            environment = {"SARVAM_API_KEY": "py_key"}

        agent = LowercaseAgent()
        module = agent.to_module()
        self.assertEqual(module["L"], "sarvam/sarvam-105b")
        self.assertEqual(module["I"]["memory"], "sessions/python-lower")
        self.assertEqual(module["A"]["name"], "lower_python_agent")
        self.assertEqual(module["T"]["fetch"]["command"], "uvx")
        self.assertEqual(module["E"]["SARVAM_API_KEY"], "py_key")

    def test_agent_run_result_dataclass(self):
        res = AgentRunResult(
            response="Hello world",
            steps=[{"thought": "test"}],
            execution_time_ms=12.5,
            session_id="session-123"
        )
        self.assertEqual(str(res), "Hello world")
        self.assertEqual(res.execution_time_ms, 12.5)
        self.assertEqual(res.session_id, "session-123")

if __name__ == "__main__":
    unittest.main()

