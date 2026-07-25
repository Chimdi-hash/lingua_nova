from genlayer import *

@gl.contract.interface
class _Recipient:
    class View: pass
    class Write: pass

@gl.contract
class TransferDumper:
    def __init__(self):
        pass
        
    @gl.public.write
    def transfer_to_eoa(self, to: Address, amount: u256):
        _Recipient(to).emit_transfer(value=amount)
