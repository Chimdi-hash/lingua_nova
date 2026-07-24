import json
from genlayer import *

class Dumper(gl.Contract):
    dump_data: str

    def __init__(self):
        self.dump_data = "{}"

    @gl.public.write
    def dump_info(self, addr: str) -> None:
        result = {}
        
        try:
            result["gl_dir"] = dir(gl)
        except Exception as e:
            result["gl_dir_error"] = str(e)
            
        try:
            result["Address_dir"] = dir(Address(addr))
        except Exception as e:
            result["Address_dir_error"] = str(e)
            
        try:
            result["gl_message_dir"] = dir(gl.message)
        except Exception as e:
            result["gl_message_dir_error"] = str(e)
            
        try:
            result["gl_vm_dir"] = dir(gl.vm)
        except Exception as e:
            result["gl_vm_dir_error"] = str(e)
            
        self.dump_data = json.dumps(result)

    @gl.public.view
    def get_dump(self) -> str:
        return self.dump_data
