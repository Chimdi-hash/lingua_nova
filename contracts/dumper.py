from genlayer import *
import json

@gl.contract
class Dumper:
    def __init__(self):
        self.gl_dir = json.dumps(dir(gl))
        try:
            self.gl_contract_dir = json.dumps(dir(gl.contract))
        except:
            self.gl_contract_dir = "[]"
        try:
            self.gl_message_dir = json.dumps(dir(gl.message))
        except:
            self.gl_message_dir = "[]"

    @gl.public.view
    def get_dump(self) -> str:
        return json.dumps({
            "gl": self.gl_dir,
            "gl.contract": self.gl_contract_dir,
            "gl.message": self.gl_message_dir
        })
