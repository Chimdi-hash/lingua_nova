from genlayer import *

@gl.contract
class Dumper2:
    def __init__(self):
        self.gl_dir = str(dir(gl))
        
    @gl.public.view
    def get_dump(self) -> str:
        return self.gl_dir
