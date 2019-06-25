import sys
import cexc
import exec_anaconda

def exec_anaconda_or_die():
    try:
        exec_anaconda.exec_anaconda()
    except Exception as e:
        cexc.abort(e)
        sys.exit(1)
