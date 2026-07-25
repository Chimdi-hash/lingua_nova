from genlayer import *

@gl.contract
class TransferDumper:
    def __init__(self):
        self.has_transfer = hasattr(self, 'transfer')
        
    @gl.public.view
    def get_dump(self) -> bool:
        return self.has_transfer
