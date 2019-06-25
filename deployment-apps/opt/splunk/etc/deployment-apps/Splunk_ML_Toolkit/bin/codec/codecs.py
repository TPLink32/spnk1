#!/usr/bin/env python

import base64
import importlib
from StringIO import StringIO
import pandas as pd

CODECS = {
    ('__builtin__', 'object'): 'NoopCodec',
    ('__builtin__', 'slice'): 'SliceCodec',
    ('__builtin__', 'set'): 'SetCodec',
    ('__builtin__', 'type'): 'TypeCodec',

    ('numpy', 'ndarray'): 'NDArrayCodec',
    ('numpy', 'int8'): 'NDArrayWrapperCodec',
    ('numpy', 'int16'): 'NDArrayWrapperCodec',
    ('numpy', 'int32'): 'NDArrayWrapperCodec',
    ('numpy', 'int64'): 'NDArrayWrapperCodec',
    ('numpy', 'uint8'): 'NDArrayWrapperCodec',
    ('numpy', 'uint16'): 'NDArrayWrapperCodec',
    ('numpy', 'uint32'): 'NDArrayWrapperCodec',
    ('numpy', 'uint64'): 'NDArrayWrapperCodec',
    ('numpy', 'float16'): 'NDArrayWrapperCodec',
    ('numpy', 'float32'): 'NDArrayWrapperCodec',
    ('numpy', 'float64'): 'NDArrayWrapperCodec',
    ('numpy', 'float128'): 'NDArrayWrapperCodec',
    ('numpy', 'complex64'): 'NDArrayWrapperCodec',
    ('numpy', 'complex128'): 'NDArrayWrapperCodec',
    ('numpy', 'complex256'): 'NDArrayWrapperCodec',
    ('numpy', 'dtype'): 'DTypeCodec',

    ('mtrand', 'RandomState'): 'mtrandCodec',

    ('pandas.core.frame', 'DataFrame'): 'SimpleObjectCodec',
    ('pandas.core.index', 'Index'): 'IndexCodec',
    ('pandas.core.index', 'Int64Index'): 'IndexCodec',
    ('pandas.core.internals', 'BlockManager'): 'BlockManagerCodec'
}


class BaseCodec(object):
    @classmethod
    def encode(cls, obj):
        raise NotImplementedError("Encoder not implemented")

    @classmethod
    def decode(cls, obj):
        raise NotImplementedError("Decoder not implemented")


class NoopCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
        }

    @classmethod
    def decode(cls, obj):
        module_name, name = obj['__mlspl_type']
        module = importlib.import_module(module_name)
        class_ref = getattr(module, name)

        new_obj = class_ref.__new__(class_ref)

        return new_obj


class SliceCodec(BaseCodec):
    whitelist = [k for k, v in CODECS.items() if v == 'SliceCodec']

    @classmethod
    def encode(cls, obj):
        name, module = type(obj).__name__, type(obj).__module__
        assert (module, name) in cls.whitelist

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'slice': obj.__reduce__()[1]
        }

    @classmethod
    def decode(cls, obj):
        module_name, name = obj['__mlspl_type']
        assert (module_name, name) in cls.whitelist

        module = importlib.import_module(module_name)
        class_ref = getattr(module, name)

        new_obj = class_ref(*obj['slice'])

        return new_obj


class SimpleObjectCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        name, module = type(obj).__name__, type(obj).__module__
        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'dict': obj.__dict__,
        }

    @classmethod
    def decode(cls, obj):
        module_name, name = obj['__mlspl_type']

        module = importlib.import_module(module_name)
        class_ref = getattr(module, name)
        new_obj = class_ref.__new__(class_ref)
        new_obj.__dict__ = obj['dict']
        for key in new_obj.__dict__:
            if isinstance(new_obj.__dict__[key], list) or isinstance(new_obj.__dict__[key], pd.Index):
                new_obj.__dict__[key] = [item.encode('utf-8') if isinstance(item, unicode) else item for item in
                                         new_obj.__dict__[key]]
            elif isinstance(new_obj.__dict__[key], unicode):
                new_obj.__dict__[key] = new_obj.__dict__[key].encode('utf-8')
        return new_obj


class IndexCodec(BaseCodec):
    whitelist = [k for k, v in CODECS.items() if v == 'IndexCodec']

    @classmethod
    def encode(cls, obj):
        name, module = type(obj).__name__, type(obj).__module__
        assert (module, name) in cls.whitelist

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'init_args': obj.__reduce__()[1][1]
        }

    @classmethod
    def decode(cls, obj):
        module_name, name = obj['__mlspl_type']
        assert (module_name, name) in cls.whitelist

        module = importlib.import_module(module_name)
        class_ref = getattr(module, name)

        new_obj = class_ref(**obj['init_args'])

        return new_obj  # pandas.core.index.Index(**obj['init_args'])


class DTypeCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'descr': obj.descr if obj.names is not None else obj.str
        }

    @classmethod
    def decode(cls, obj):
        import numpy as np
        return np.dtype(obj['descr'])


class NDArrayWrapperCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        import numpy as np
        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'ndarray': np.array([obj])
        }

    @classmethod
    def decode(cls, obj):
        import numpy as np
        return obj['ndarray'][0]


class NDArrayCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        import numpy as np
        assert type(obj) == np.ndarray

        if obj.dtype.hasobject:
            try:
                obj = obj.astype('U')
            except:
                raise ValueError("Cannot encode numpy.ndarray with objects")

        sio = StringIO()
        np.save(sio, obj, allow_pickle=False)

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'npy': base64.b64encode(sio.getvalue())
        }

    @classmethod
    def decode(cls, obj):
        import numpy as np

        sio = StringIO(base64.b64decode(obj['npy']))
        return np.load(sio, allow_pickle=False)


class TreeCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        import sklearn.tree
        assert type(obj) == sklearn.tree._tree.Tree

        init_args = obj.__reduce__()[1]
        state = obj.__getstate__()

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'init_args': init_args,
            'state': state
        }

    @classmethod
    def decode(cls, obj):
        import sklearn.tree

        init_args = obj['init_args']
        state = obj['state']

        t = sklearn.tree._tree.Tree(*init_args)
        t.__setstate__(state)

        return t


class BlockManagerCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        from pandas.core.internals import BlockManager
        assert type(obj) == BlockManager

        state = obj.__getstate__()

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'state': state
        }

    @classmethod
    def decode(cls, obj):
        from pandas.core.internals import BlockManager

        state = obj['state']

        t = BlockManager.__new__(BlockManager)
        t.__setstate__(state)

        return t


class SetCodec(BaseCodec):
    whitelist = [k for k, v in CODECS.items() if v == 'SetCodec']

    @classmethod
    def encode(cls, obj):
        name, module = type(obj).__name__, type(obj).__module__
        assert (module, name) in cls.whitelist

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'set': list(obj),
        }

    @classmethod
    def decode(cls, obj):
        module_name, name = obj['__mlspl_type']
        assert (module_name, name) in cls.whitelist

        return set(obj['set'])


class TypeCodec(BaseCodec):
    whitelist = [k for k, v in CODECS.items() if v == 'TypeCodec']

    @classmethod
    def encode(cls, obj):
        name, module = type(obj).__name__, type(obj).__module__
        assert (module, name) in cls.whitelist

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'type': [obj.__module__, obj.__name__],
        }

    @classmethod
    def decode(cls, obj):
        module_name, name = obj['__mlspl_type']
        assert (module_name, name) in cls.whitelist
        assert (obj['type'][0], obj['type'][1]) in CODECS

        module = importlib.import_module(obj['type'][0])

        return getattr(module, obj['type'][1])

class mtrandCodec(BaseCodec):
    @classmethod
    def encode(cls, obj):
        import numpy as np
        assert type(obj) == np.random.mtrand.RandomState

        init_args = obj.__reduce__()[1]
        state = obj.__getstate__()

        return {
            '__mlspl_type': [type(obj).__module__, type(obj).__name__],
            'init_args': init_args,
            'state': state
        }

    @classmethod
    def decode(cls, obj):
        from numpy.random.mtrand import RandomState

        init_args = obj['init_args']
        state = obj['state']

        t = RandomState(*init_args)
        t.__setstate__(state)

        return t
